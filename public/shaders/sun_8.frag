uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// --- NOISE ---
// Simpler noise for liquid wobble, not texture
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

// --- FRESH PALETTE ---
// Avoids muddy mid-tones. Focuses on distinct, vibrant hues.
vec3 getFreshPalette(float t) {
    vec3 c1 = vec3(1.0, 0.5, 0.1); // Vibrant Orange
    vec3 c2 = vec3(0.1, 0.8, 0.9); // Cyan
    vec3 c3 = vec3(1.0, 0.2, 0.6); // Hot Pink
    vec3 c4 = vec3(1.0, 0.9, 0.2); // Sunny Yellow
    vec3 c5 = vec3(0.5, 0.3, 1.0); // Electric Purple
    
    // Cycle through 5 stages
    float cycle = fract(t * 0.1); 
    float stage = cycle * 5.0;
    float i = floor(stage);
    float f = fract(stage);

    if(i == 0.0) return mix(c1, c2, f);
    if(i == 1.0) return mix(c2, c3, f);
    if(i == 2.0) return mix(c3, c4, f);
    if(i == 3.0) return mix(c4, c5, f);
    return mix(c5, c1, f);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 centeredUv = uv - 0.5;
    
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    // --- CYCLES ---
    // Bias towards brightness (Shifted Sine)
    // Range: -0.2 (Brief Dark) to 1.2 (Very Bright)
    float brightnessCycle = sin(uTime * 0.3) * 0.7 + 0.5;

    // --- LIQUID DISTORTION ---
    // Instead of cloud texture, we warp the coordinate space gently
    float wave = noise(centeredUv * 2.0 + uTime * 0.2);
    float distortion = (wave - 0.5) * 0.05; // Subtle warp
    
    float dist = length(centeredUv) + distortion;

    // --- GEOMETRY: CORE VS CORONA ---
    
    float radiusCore = 0.2 + sin(uTime * 0.5) * 0.03;
    float radiusCorona = 0.42; // Outer limit

    // 1. Core Shape (More distinct)
    // Uses a tighter smoothstep
    float coreAlpha = 1.0 - smoothstep(radiusCore - 0.05, radiusCore + 0.05, dist);

    // 2. Corona Shape (Mist / Flare)
    // Starts inside the core and fades out to the limit
    float coronaAlpha = 1.0 - smoothstep(radiusCore * 0.5, radiusCorona, dist);

    // --- COLOR LOGIC ---
    
    // Core Color: Time based
    vec3 colCore = getFreshPalette(uTime);
    // Corona Color: Offset time + slight hue shift based on angle for "Flare" feel
    float angle = atan(centeredUv.y, centeredUv.x);
    vec3 colCorona = getFreshPalette(uTime + 0.4 + angle * 0.1);

    // Intensity/Brightness Logic
    if (brightnessCycle > 0.3) {
        // BRIGHT MODE (Default)
        // Add white to center to make it look hot/airy
        float whiteness = (brightnessCycle - 0.3) * 0.8;
        colCore = mix(colCore, vec3(1.0), whiteness * 0.6);
        colCorona = mix(colCorona, vec3(0.95, 0.98, 1.0), whiteness * 0.3);
    } else {
        // DARK/INTENSE MODE (Brief)
        // Boost saturation, lower lightness
        colCore = pow(colCore, vec3(1.5)); 
        colCorona *= 0.8; 
    }

    // --- COMPOSITING ---
    
    // Mix Core and Corona
    // We want the core to sit "inside" the corona.
    
    // Base: White Background
    vec3 finalColor = vec3(1.0);
    
    // Render Corona first (Soft background glow)
    // Clamp corona alpha carefully to avoid hard edge at max radius
    float coronaVis = clamp(coronaAlpha, 0.0, 1.0);
    
    // Safety Mask for screen edge (Hard limit)
    float safety = 1.0 - smoothstep(0.45, 0.48, length(centeredUv));
    coronaVis *= safety;

    finalColor = mix(finalColor, colCorona, coronaVis * 0.8); // 0.8 opacity max
    
    // Render Core on top (Liquid center)
    float coreVis = clamp(coreAlpha, 0.0, 1.0);
    // Blend core softly
    finalColor = mix(finalColor, colCore, coreVis);

    // Add a subtle "Rim Light" or "Glare" at the transition point
    // This emphasizes the Core/Corona separation requested
    float rim = smoothstep(radiusCore - 0.02, radiusCore, dist) * (1.0 - smoothstep(radiusCore, radiusCore + 0.02, dist));
    finalColor += vec3(0.2) * rim * brightnessCycle; // Subtle white rim

    gl_FragColor = vec4(finalColor, 1.0);
}
