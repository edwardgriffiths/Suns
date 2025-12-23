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

// --- PALETTE ---
vec3 getWidePalette(float t) {
    vec3 c1 = vec3(1.0, 0.4, 0.2); // Soft Orange
    vec3 c2 = vec3(0.0, 0.8, 0.6); // Teal/Mint
    vec3 c3 = vec3(0.5, 0.2, 0.8); // Deep Violet
    vec3 c4 = vec3(1.0, 0.9, 0.1); // Bright Gold
    vec3 c5 = vec3(0.1, 0.4, 0.9); // Royal Blue
    vec3 c6 = vec3(0.9, 0.1, 0.4); // Raspberry

    float cycle = fract(t * 0.08); 
    
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

    // --- TIME & CYCLES ---
    // Independent cycles for different attributes to ensure variety
    float slowTime = uTime * 0.2;
    
    // Cycle: Edge Sharpness (0.0 = Misty, 1.0 = Distinct)
    // Uses a complex wave to stay misty longer, but occasionally sharpen
    float cycleSharpness = smoothstep(0.2, 0.8, sin(slowTime * 0.7) * 0.5 + 0.5); 
    
    // Cycle: Center Mood (-1 = Dark/Intense, 0 = Vivid, 1 = Bright/Airy)
    float cycleCenterMode = sin(slowTime * 0.5); 
    
    // Cycle: Outer Mood (Offset from center)
    float cycleOuterMode = sin(slowTime * 0.4 + 2.0);

    // Cycle: Bleed Variance (How blended are center and outer?)
    float cycleBleed = sin(slowTime * 1.1 + 1.0) * 0.5 + 0.5;

    // --- SHAPE & DISTORTION ---
    
    // Base radius
    float baseRadius = 0.35 + 0.05 * sin(uTime * 0.3);

    // Calculate Edge Softness based on Sharpness Cycle
    // Misty = 0.4 spread, Distinct = 0.02 spread
    float edgeSoftness = mix(0.4, 0.02, cycleSharpness);

    // Distortion (Noise)
    // We reduce distortion when the edge is sharp to make it look cleaner
    float n = fbm(centeredUv * 3.0 + uTime * 0.1);
    float distortionAmount = 0.1 * (1.0 - cycleSharpness * 0.8); // 80% less distortion when sharp
    float distortion = (n - 0.5) * distortionAmount;
    
    float d = length(centeredUv) + distortion;

    // --- ALPHA / DENSITY ---
    // Single continuous density field to prevent white rings
    float alpha = 1.0 - smoothstep(baseRadius, baseRadius + edgeSoftness, d);

    // Strict Safety Clamp (Screen Edge)
    // Ensures pure white at edges regardless of mist
    float safetyLimit = 0.48; // Close to 0.5 edge
    alpha *= (1.0 - smoothstep(safetyLimit - 0.05, safetyLimit, length(centeredUv)));

    // --- COLORS & INTENSITY ---

    vec3 colCenter = getWidePalette(uTime * 0.15);
    vec3 colOuter = getWidePalette(uTime * 0.15 + 0.4); // Offset hue

    // Apply "Mood" to Center
    if (cycleCenterMode > 0.4) {
        // Bright/Airy Mode
        float t = (cycleCenterMode - 0.4) * 1.6; // Norm 0-1
        colCenter = mix(colCenter, vec3(1.0), t * 0.7); // Wash out to white
    } else if (cycleCenterMode < -0.4) {
        // Dark/Intense Mode
        float t = (abs(cycleCenterMode) - 0.4) * 1.6;
        colCenter *= (1.0 - t * 0.6); // Darken
        colCenter = pow(colCenter, vec3(1.2)); // Increase contrast
    }

    // Apply "Mood" to Outer (Independent)
    if (cycleOuterMode > 0.4) {
        float t = (cycleOuterMode - 0.4) * 1.6;
        colOuter = mix(colOuter, vec3(1.0), t * 0.6);
    } else if (cycleOuterMode < -0.4) {
        float t = (abs(cycleOuterMode) - 0.4) * 1.6;
        colOuter *= (1.0 - t * 0.5);
        colOuter = pow(colOuter, vec3(1.2));
    }

    // --- COLOR MIXING (BLEED) ---
    
    // Determine how wide the transition area is between center and outer
    float bleedWidth = mix(0.1, 0.5, cycleBleed);
    float pivot = baseRadius * 0.4; // Transition happens inside the shape
    
    // Calculate mixing factor
    // We use the distorted distance 'd' to ensure the color follows the shape
    float mixFactor = smoothstep(pivot - bleedWidth, pivot + bleedWidth, d);
    
    vec3 finalColor = mix(colCenter, colOuter, mixFactor);

    // --- FINAL COMPOSITE ---
    vec3 bg = vec3(1.0);
    
    // Clamp alpha
    alpha = clamp(alpha, 0.0, 1.0);
    
    gl_FragColor = vec4(mix(bg, finalColor, alpha), 1.0);
}
