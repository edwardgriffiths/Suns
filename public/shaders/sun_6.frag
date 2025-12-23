uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// --- NOISE ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- EXTENDED PALETTE ---
// Wider range of colors including cool tones and deep variants
vec3 getWidePalette(float t) {
    vec3 c1 = vec3(1.0, 0.4, 0.2); // Soft Orange
    vec3 c2 = vec3(0.0, 0.8, 0.6); // Teal/Mint
    vec3 c3 = vec3(0.5, 0.2, 0.8); // Deep Violet
    vec3 c4 = vec3(1.0, 0.9, 0.1); // Bright Gold
    vec3 c5 = vec3(0.1, 0.4, 0.9); // Royal Blue
    vec3 c6 = vec3(0.9, 0.1, 0.4); // Raspberry

    float cycle = fract(t * 0.08); // Slow full spectrum cycle
    
    // 6-stage gradient mix
    float stage = cycle * 6.0;
    float i = floor(stage);
    float f = fract(stage);

    if(i == 0.0) return mix(c1, c2, f);
    if(i == 1.0) return mix(c2, c3, f);
    if(i == 2.0) return mix(c3, c4, f);
    if(i == 3.0) return mix(c4, c5, f);
    if(i == 4.0) return mix(c5, c6, f);
    return mix(c6, c1, f);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 centeredUv = uv - 0.5;
    
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    float dist = length(centeredUv);

    // --- INVERSE DYNAMICS ---
    
    // Cycle: 0.0 to 1.0
    float cycle = sin(uTime * 0.4) * 0.5 + 0.5;
    
    // CORE: shrinks and grows
    // Range: 0.1 (small) to 0.28 (large)
    float coreRadius = mix(0.1, 0.28, cycle);
    
    // ATMOSPHERE: Fills out when core is small
    // Range: 0.45 (wide spread) to 0.32 (tighter spread)
    float outerLimit = 0.46; // Strict max radius to keep white edge
    float mistSpread = mix(outerLimit, 0.35, cycle); // Inverse to core

    // Density increases when core is small to "fill" the visual weight
    float mistDensityFactor = mix(1.2, 0.5, cycle);

    // --- SHAPE GENERATION ---

    // 1. The Core (Stable, Circular)
    // Use a very soft smoothstep for the core edge
    float coreShape = 1.0 - smoothstep(coreRadius * 0.5, coreRadius + 0.05, dist);

    // 2. The Atmosphere (Misty, Variable)
    // Noise distorts the density, NOT the position (keeps it generally circular)
    float atmosphereNoise = fbm(centeredUv * 4.0 + uTime * 0.15);
    
    // Radial falloff for atmosphere
    float atmosphereRadial = smoothstep(mistSpread, coreRadius * 0.8, dist);
    
    // Combine radial shape with noise texture
    float atmosphereShape = atmosphereRadial * (0.4 + 0.6 * atmosphereNoise);
    atmosphereShape *= mistDensityFactor; // Modulate density based on cycle

    // Combine Core and Atmosphere
    // We use max to ensure the core remains solid even if mist is noisy
    float totalAlpha = max(coreShape, atmosphereShape);

    // --- STRICT SAFETY MASK ---
    // Absolutely cuts off before edge of image
    float safetyEdge = smoothstep(outerLimit, outerLimit - 0.05, dist);
    totalAlpha *= safetyEdge;

    // --- COLOR APPLICATION ---

    // Sample palette at different offsets to create variety within the orb
    // Distort the lookup slightly for "fluid" internal color
    float colorNoise = noise(centeredUv * 2.0 - uTime * 0.1);
    
    vec3 colCenter = getWidePalette(uTime);
    vec3 colEdge = getWidePalette(uTime + 0.3 + colorNoise * 0.2);
    
    // Mix based on distance from center
    vec3 finalRGB = mix(colCenter, colEdge, smoothstep(0.0, mistSpread, dist));
    
    // Add a "bloom" of light to the core to make it feel hot
    finalRGB += vec3(0.15) * coreShape;

    // --- FINAL COMPOSITE ---
    
    vec3 bg = vec3(1.0); // White
    
    // Clamp alpha
    totalAlpha = clamp(totalAlpha, 0.0, 1.0);
    
    // Mix over white
    vec3 result = mix(bg, finalRGB, totalAlpha);

    gl_FragColor = vec4(result, 1.0);
}
