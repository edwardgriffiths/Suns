uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// --- NOISE FUNCTIONS ---

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Standard 2D Noise
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

// Fractal Brownian Motion for cloud-like structures
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- COLOR PALETTES ---

vec3 getVibrantCycle(float t) {
    // Fresh, non-muddy colors
    vec3 c1 = vec3(1.0, 0.3, 0.1); // Hot Orange
    vec3 c2 = vec3(1.0, 0.8, 0.0); // Gold
    vec3 c3 = vec3(0.1, 0.6, 0.9); // Electric Blue
    vec3 c4 = vec3(0.9, 0.1, 0.6); // Magenta
    
    float cycle = fract(t * 0.2); // Slow cycle
    
    if(cycle < 0.25) return mix(c1, c2, cycle * 4.0);
    if(cycle < 0.50) return mix(c2, c3, (cycle - 0.25) * 4.0);
    if(cycle < 0.75) return mix(c3, c4, (cycle - 0.50) * 4.0);
    return mix(c4, c1, (cycle - 0.75) * 4.0);
}

vec3 getDarkIntensity(float t) {
    // Deep, intense, darker colors
    vec3 c1 = vec3(0.5, 0.0, 0.1); // Deep Crimson
    vec3 c2 = vec3(0.2, 0.0, 0.4); // Deep Violet
    vec3 c3 = vec3(0.0, 0.2, 0.4); // Dark Teal
    
    float cycle = fract(t * 0.15);
    if(cycle < 0.33) return mix(c1, c2, cycle * 3.0);
    if(cycle < 0.66) return mix(c2, c3, (cycle - 0.33) * 3.0);
    return mix(c3, c1, (cycle - 0.66) * 3.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 centeredUv = uv - 0.5;
    
    // Aspect Ratio Correction
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    // --- TIME VARIABLES ---
    // Independent timelines for variance
    float tMist = uTime * 0.12;
    float tFlare = uTime * 0.4;
    float tDeep = uTime * 0.08;

    // --- SHAPE & MIST ---
    
    // FBM Noise for cloud-like structure (prevents banding)
    float cloudNoise = fbm(centeredUv * 3.0 + uTime * 0.1);
    
    // Mist Cycle: 0 (compact) to 1 (spread/indistinct)
    float mistFactor = smoothstep(-0.2, 0.8, sin(tMist)); 
    
    // Distort distance based on mist
    // We use cloudNoise to break the perfect circle
    float distortion = (cloudNoise - 0.5) * (0.1 + mistFactor * 0.25);
    float dist = length(centeredUv) + distortion;

    // --- MASKS ---
    
    float radius = 0.2; // Keep base radius fairly constant
    
    // Softness varies significantly with mist
    float softness = 0.1 + mistFactor * 0.35;
    
    // MAIN BODY MASK
    float bodyAlpha = 1.0 - smoothstep(radius, radius + softness, dist);

    // --- COLOR ZONES ---

    // 1. Calculate Core vs Outer
    // We use noise in the mixing factor to AVOID RINGS
    float mixNoise = noise(centeredUv * 4.0 - uTime * 0.2);
    float mixingZone = smoothstep(0.0, radius * 1.2, dist + mixNoise * 0.1);

    // 2. Base Colors
    vec3 colInner = getVibrantCycle(uTime + 0.5);
    vec3 colOuter = getVibrantCycle(uTime); // Offset time for difference
    
    // 3. Deep/Intense Mode
    // Occasionally, blend in the dark/intense palette
    float deepCycle = smoothstep(0.6, 0.9, sin(tDeep)); // Spikes occasionally
    vec3 deepCol = getDarkIntensity(uTime);
    
    colInner = mix(colInner, deepCol, deepCycle * 0.7); // Center goes deep
    colOuter = mix(colOuter, deepCol * 1.2, deepCycle * 0.5); // Edge goes deep

    // 4. Initial Mix
    vec3 baseColor = mix(colInner, colOuter, mixingZone);

    // --- FLARES & CORONAL GLARE ---
    
    // FIX: Use a vec2 for noise function (Angle + Time)
    float angle = atan(centeredUv.y, centeredUv.x);
    // We map the angle and time to a 2D coordinate for the noise function
    float edgeNoise = noise(vec2(angle * 4.0, tFlare));
    
    // Flash intensity spikes randomly
    float flash = smoothstep(0.4, 0.8, sin(uTime * 0.7 + edgeNoise * 3.0)); 
    
    // Flare Color: often complementary or very bright
    vec3 flareColor = vec3(1.0) - colOuter; // Invert for contrast
    flareColor = mix(flareColor, vec3(1.0, 1.0, 1.0), 0.5); // Whiten it slightly
    
    // Apply flare only at the fuzzy edge
    float flareMask = smoothstep(radius, radius + 0.15, dist) * (1.0 - smoothstep(radius + 0.15, radius + 0.4, dist));
    flareMask *= flash * mistFactor; // Flares are stronger when misty/active

    baseColor += flareColor * flareMask * 0.6; // Additively blend flare

    // --- CENTER VARIANCE ---
    // Allow more colors to spawn near center (random blobs)
    float blobNoise = noise(centeredUv * 8.0 + uTime * 0.3);
    vec3 blobColor = getVibrantCycle(uTime + 2.0);
    float blobMask = smoothstep(0.6, 0.8, blobNoise) * (1.0 - mixingZone); // Only near center
    
    baseColor = mix(baseColor, blobColor, blobMask * 0.4);

    // --- POST PROCESSING ---
    
    // Grain (reduced to stop flickering)
    float subtleGrain = (random(uv + uTime * 0.1) - 0.5) * 0.04;
    baseColor += subtleGrain;

    // Strict Safety Containment
    // Ensure strictly white at edges.
    float safeDist = length(centeredUv);
    float safetyMask = 1.0 - smoothstep(0.4, 0.48, safeDist);
    
    bodyAlpha *= safetyMask;

    // --- FINAL COMPOSITION ---
    
    vec3 bgColor = vec3(1.0);
    
    // Mist opacity adjustment: 
    // When very misty, the whole object becomes slightly translucent to blend better
    float masterOpacity = 1.0 - (mistFactor * 0.15);

    vec3 finalColor = mix(bgColor, baseColor, bodyAlpha * masterOpacity);
    
    // Clamp to avoid artifacts
    finalColor = clamp(finalColor, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
}
