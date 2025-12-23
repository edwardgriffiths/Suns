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

    // --- CYCLES ---
    
    // 1. Density Bias Angle: Rotates slowly around the circle
    float biasAngle = tSlow * 0.5;
    
    // 2. Core Bleed Amount: How soft is the transition?
    // Oscillates between sharp (0.05) and very soft (0.4)
    float bleedAmount = sin(tSlow * 0.7) * 0.175 + 0.225;

    // --- GEOMETRY ---

    // Standard Euclidean distance with subtle liquid warp (no directional bias)
    float liquid = noise(centeredUv * 3.0 + uTime * 0.15);
    float dist = length(centeredUv) + (liquid - 0.5) * 0.03;

    // Radii
    float rCore = 0.2;
    float rCoronaMax = 0.45; // Max limit before white border

    // --- MASKS & DENSITY ---

    // Corona Mask: Fills the space out to rCoronaMax
    // We use a soft falloff only near the very edge to keep it filling the space
    float coronaShape = smoothstep(rCoronaMax + 0.02, rCoronaMax - 0.05, dist);

    // **Density Bias Calculation**
    // Calculate angle of current pixel
    float angle = atan(centeredUv.y, centeredUv.x);
    
    // Map angle to a noise field that rotates
    // We use a seamless noise loop based on angle
    float angleNoise = noise(vec2(cos(angle) + uTime * 0.2, sin(angle) + uTime * 0.2));
    
    // Bias Strength: varies over time (sometimes uniform, sometimes biased)
    float biasStrength = sin(tSlow) * 0.5 + 0.5; // 0 to 1
    
    // Apply bias to density
    // Areas with low noise value become misty, high value become dense
    float localDensity = 0.4 + 0.6 * angleNoise; // Base density varies 0.4 to 1.0
    
    // Combine shape and density variance
    float finalCoronaAlpha = coronaShape * localDensity;

    // --- CORE BLEED ---

    // Core Shape
    // We create a separate mask for the core to blend it on top
    // The smoothness of this step determines the bleed
    float coreMask = 1.0 - smoothstep(rCore, rCore + bleedAmount, dist);

    // --- COLORS ---

    vec3 colCore = getFreshPalette(uTime);
    
    // Corona Color: Seamless gradient
    vec3 colCorona = getFreshPalette(uTime + 0.3 + sin(angle) * 0.15);

    // Intensity Variation
    float intensity = smoothstep(0.85, 1.0, sin(tSlow * 1.5));
    if (intensity > 0.0) {
            vec3 intenseCol = vec3(0.8, 0.0, 0.2); 
            colCore = mix(colCore, intenseCol, intensity * 0.4);
            colCorona = mix(colCorona, intenseCol, intensity * 0.2);
    }

    // --- COMPOSITING ---
    
    vec3 bg = vec3(1.0); // White background
    vec3 finalColor = bg;

    // 1. Render Corona
    // Strict Safety: Ensure absolutely 0 opacity at screen limit (0.48)
    float safety = 1.0 - smoothstep(0.44, 0.48, length(centeredUv));
    finalCoronaAlpha *= safety;
    
    // Mix corona over background
    // We clamp opacity to avoid "solid" look if noise is high, keeping it "misty"
    float maxOpacity = 0.85; 
    finalColor = mix(finalColor, colCorona, finalCoronaAlpha * maxOpacity);

    // 2. Render Core / Bleed
    // We mix the core color into the existing corona/bg mix
    // The 'coreMask' handles the bleed softness
    
    // To allow "merging", we sometimes reduce the distinctness of the core color
    // vs the corona color, but geometrically the bleed stays variable
    finalColor = mix(finalColor, colCore, coreMask);

    // --- FINAL TOUCHES ---
    
    // Grain for texture (very subtle)
    float grain = (random(uv + uTime) - 0.5) * 0.03;
    finalColor += grain;

    gl_FragColor = vec4(finalColor, 1.0);
}
