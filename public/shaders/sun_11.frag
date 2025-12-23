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

// Fractal Brownian Motion for ragged/irregular density
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

// --- FRESH PALETTE ---
// Vibrant, high saturation colors
vec3 getFreshPalette(float t) {
    vec3 c1 = vec3(1.0, 0.4, 0.0); // Electric Orange
    vec3 c2 = vec3(0.0, 0.9, 0.8); // Cyan
    vec3 c3 = vec3(1.0, 0.1, 0.5); // Magenta
    vec3 c4 = vec3(0.9, 1.0, 0.1); // Lime/Yellow
    vec3 c5 = vec3(0.5, 0.2, 0.9); // Deep Violet
    
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
    float angle = atan(centeredUv.y, centeredUv.x);

    // --- CYCLES ---
    
    // 1. Density Chaos: Modulates how broken/ragged the mist is
    float densityChaos = sin(tSlow * 0.4) * 0.5 + 0.5; 
    
    // 2. Global Bleed Cycle: Base amount of blur between core/corona
    float bleedCycle = sin(tSlow * 0.6) * 0.5 + 0.5;

    // --- GEOMETRY ---

    // Liquid warp for the base shape to keep it organic
    float liquid = noise(centeredUv * 3.0 + vec2(uTime * 0.1));
    float dist = length(centeredUv) + (liquid - 0.5) * 0.03;

    // Radii
    float rCore = 0.2;
    float rCoronaMax = 0.45; 

    // --- MASKS & DENSITY VARIANCE ---

    // Corona Shape: Always fills the space out to the limit
    float coronaShape = smoothstep(rCoronaMax + 0.02, rCoronaMax - 0.05, dist);

    // **High-Variance Density Calculation**
    // Use FBM on the angle to create irregular clouds/gaps around the ring.
    // We rotate the coordinate system for the noise to make it drift naturally.
    vec2 densityCoord = vec2(cos(angle), sin(angle)) * (2.0 + densityChaos * 2.0);
    densityCoord += vec2(uTime * 0.1, uTime * 0.05);
    
    float mistNoise = fbm(densityCoord);
    
    // Map noise to opacity: sharper contrast means more variance (gaps vs thick patches)
    float localDensity = smoothstep(0.2, 0.9, mistNoise); 
    
    // Ensure we never lose the shape entirely, maintain a base haze
    localDensity = 0.3 + 0.7 * localDensity;

    float finalCoronaAlpha = coronaShape * localDensity;

    // --- SPATIALLY VARIABLE BLEED ---

    // Instead of uniform bleed, vary it around the circle using noise.
    // This creates the effect where one side is sharp, another is soft.
    float bleedNoise = noise(vec2(angle * 3.0, uTime * 0.2));
    float currentBleedWidth = mix(0.01, 0.35, bleedCycle); // Global variance
    currentBleedWidth *= (0.5 + bleedNoise); // Local variance factor
    
    // Apply bleed to core mask
    float coreMask = 1.0 - smoothstep(rCore, rCore + currentBleedWidth, dist);

    // --- COLORS & INTENSITY ---

    vec3 colCore = getFreshPalette(uTime);
    
    // Corona Color: varying hue around the ring based on noise
    float hueShift = noise(vec2(angle, uTime * 0.05)) * 0.5;
    vec3 colCorona = getFreshPalette(uTime + 0.4 + hueShift);

    // **Intensity Surge**
    // Randomized peaks of high saturation/contrast
    float intensitySurge = noise(vec2(uTime * 0.5, 0.0)); 
    intensitySurge = smoothstep(0.6, 1.0, intensitySurge); // Only peaks
    
    if (intensitySurge > 0.01) {
        // Boost saturation and brightness
        vec3 boost = vec3(0.2) * intensitySurge;
        colCore += boost;
        colCore = pow(colCore, vec3(1.2)); // Increase contrast
        colCorona *= (1.0 + intensitySurge * 0.5); // Brighten corona
    }

    // --- COMPOSITING ---
    
    vec3 bg = vec3(1.0); 
    vec3 finalColor = bg;

    // 1. Corona Layer
    // Safety edge clamp to keep white border
    float safety = 1.0 - smoothstep(0.44, 0.48, length(centeredUv));
    finalCoronaAlpha *= safety;
    
    // Mix corona over background
    finalColor = mix(finalColor, colCorona, finalCoronaAlpha * 0.9);

    // 2. Core Layer (Variable Bleed)
    // Mix core over the corona/bg composite
    finalColor = mix(finalColor, colCore, coreMask);

    // --- TEXTURE ---
    float grain = (random(uv + uTime) - 0.5) * 0.04;
    finalColor += grain;

    gl_FragColor = vec4(finalColor, 1.0);
}
