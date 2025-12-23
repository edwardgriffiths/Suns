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

// --- FRESH PALETTE ---
// Clean, vibrant colors.
vec3 getFreshPalette(float t) {
    vec3 c1 = vec3(1.0, 0.5, 0.1); // Vibrant Orange
    vec3 c2 = vec3(0.0, 0.8, 0.9); // Cyan
    vec3 c3 = vec3(1.0, 0.2, 0.6); // Hot Pink
    vec3 c4 = vec3(1.0, 0.9, 0.2); // Sunny Yellow
    vec3 c5 = vec3(0.4, 0.2, 1.0); // Electric Purple
    
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

    float tSlow = uTime * 0.2;

    // --- GLOBAL CYCLES ---
    
    // 1. Merge Cycle: 0 = Distinct Layers, 1 = Blurred/Merged
    float mergeFactor = sin(tSlow * 0.8) * 0.5 + 0.5;
    
    // 2. Flare Bias Cycle: Determines direction of exterior stretch
    vec2 biasDir = vec2(cos(tSlow * 0.5), sin(tSlow * 0.5));
    float biasStrength = sin(tSlow * 1.3) * 0.15 + 0.15; // 0.0 to 0.3

    // --- GEOMETRY ---

    // Distance 1: The Core (Standard Euclidean distance)
    // Liquid distortion added to keep it organic but circular
    float liquid = noise(centeredUv * 3.0 + uTime * 0.2);
    float coreDist = length(centeredUv) + (liquid - 0.5) * 0.04;

    // Distance 2: The Corona (Biased/Flaring distance)
    // We shift the center calculation for the corona to create the "bias"
    vec2 biasedUv = centeredUv - biasDir * biasStrength;
    // Also distort the shape slightly to make it non-perfect
    float coronaDist = length(biasedUv) + (liquid - 0.5) * 0.08;

    // Radii
    float rCore = 0.2;
    float rCorona = 0.45;

    // --- MASKS ---

    // Core Alpha: Distinct edge, but softens based on mergeFactor
    float coreEdge = mix(0.02, 0.2, mergeFactor);
    float coreAlpha = 1.0 - smoothstep(rCore, rCore + coreEdge, coreDist);

    // Corona Alpha: Soft edge, creates the glow/flare
    // Fades out towards the exterior limit
    float coronaAlpha = 1.0 - smoothstep(0.1, rCorona, coronaDist);

    // --- COLORS ---

    vec3 colCore = getFreshPalette(uTime);
    
    // Exterior color calculation without the "Left Line" artifact.
    // Using sin(angle) creates a seamless gradient loop.
    float angle = atan(centeredUv.y, centeredUv.x);
    float seamlessAngle = sin(angle); 
    vec3 colCorona = getFreshPalette(uTime + 0.3 + seamlessAngle * 0.15);

    // Intensity Variation (Occasional intensity boost)
    float intensity = smoothstep(0.8, 1.0, sin(tSlow * 1.5));
    if (intensity > 0.0) {
            vec3 intenseCol = vec3(0.8, 0.0, 0.2); // Deep Red overlap
            colCore = mix(colCore, intenseCol, intensity * 0.4);
            colCorona = mix(colCorona, intenseCol, intensity * 0.2);
    }

    // --- COMPOSITING ---
    
    vec3 bg = vec3(1.0); // White background
    vec3 finalColor = bg;

    // 1. Lay down the Corona/Flare
    // Safety: Soft fade at absolute screen limits (0.48)
    float safety = 1.0 - smoothstep(0.40, 0.55, length(centeredUv));
    coronaAlpha *= safety;
    
    // Mix corona over background
    // If merged, corona becomes less opaque to allow core to dominate gradient
    float coronaOpacity = 0.8;
    finalColor = mix(finalColor, colCorona, coronaAlpha * coronaOpacity);

    // 2. Lay down the Core
    // If mergeFactor is high, the core isn't a solid layer on top, 
    // but blending with the background color (corona).
    
    if (mergeFactor > 0.8) {
        // Highly merged: Smooth gradient from center outward
        // We use coreDist directly to mix colors rather than alpha stacking
        float grad = smoothstep(rCorona, 0.0, coronaDist); // 1 at center, 0 at edge
        finalColor = mix(finalColor, colCore, grad * 0.6);
    } else {
        // Distinct Layers: Core sits on top
        // Soften the core alpha slightly so it's not a hard cutout
        finalColor = mix(finalColor, colCore, coreAlpha);
    }

    // --- FINAL TOUCHES ---
    
    // Brightness boost for "Airy" feel
    // When core is merging, we boost brightness to blend them
    finalColor += vec3(0.08) * mergeFactor * coreAlpha;

    gl_FragColor = vec4(finalColor, 1.0);
}
