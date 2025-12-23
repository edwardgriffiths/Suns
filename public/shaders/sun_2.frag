uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Simple pseudo-random noise
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 2D Noise function
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

// Retro Sun Color Palette
vec3 getSunColor(float t) {
    vec3 core = vec3(1.0, 0.9, 0.4);   // Bright Yellow-White
    vec3 inner = vec3(1.0, 0.6, 0.1);  // Warm Orange
    vec3 outer = vec3(0.9, 0.2, 0.5);  // Pinkish-Red
    vec3 glow = vec3(0.6, 0.1, 0.8);   // Deep Magenta

    float cycle = sin(t * 0.5) * 0.5 + 0.5; 
    
    vec3 col = mix(core, inner, cycle);
    col = mix(col, outer, smoothstep(0.2, 0.8, cycle));
    col = mix(col, glow, smoothstep(0.6, 1.0, cycle));
    
    return col;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 centeredUv = uv - 0.5;
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    // --- CYCLES OF VARIANCE ---
    
    // 1. Mist Cycle: Shifts from 0 (sharp) to 1 (very indistinct/misty)
    float tMist = uTime * 0.15; // Slow cycle
    float mistFactor = smoothstep(-0.2, 0.8, sin(tMist)); 

    // 2. Core Cycle: Shifts from 0 (pale/hollow center) to 1 (strong/bold center)
    float tCore = uTime * 0.22 + 2.0; // Different speed/offset to desynchronize
    float coreStrength = sin(tCore) * 0.6 + 0.4; // Range approx -0.2 to 1.0
    
    // --- SHAPE DISTORTION ---

    // Generate noise based on position and time
    // More noise magnitude when mistFactor is high
    float n = noise(centeredUv * 3.0 + uTime * 0.2);
    
    // Distort the distance field. 
    // When mistFactor is low, distortion is tiny. When high, it's significant.
    float distortionAmount = 0.02 + mistFactor * 0.15;
    float dist = length(centeredUv) + (n - 0.5) * distortionAmount;

    // --- MASKS ---

    // Dynamic radius (breathing)
    float radius = 0.25 + sin(uTime * 0.8) * 0.02;

    // Edge Softness: Increases significantly with mistFactor
    float softness = 0.05 + mistFactor * 0.5;

    // The main body of the sun/glow
    // We use 1.0 - smoothstep to create the radial gradient
    float body = 1.0 - smoothstep(radius, radius + softness, dist);

    // Calculate a "Core" mask specifically for the center
    float coreDist = length(centeredUv); // Undistorted distance for the core center
    float coreMask = 1.0 - smoothstep(0.0, radius * 0.8, coreDist);

    // --- COLOR LOGIC ---

    vec3 sunColor = getSunColor(uTime * 0.3);
    vec3 bgColor = vec3(1.0); // White background

    // Logic for "Surrounding glow taking over" (Pale Center)
    // If coreStrength is low, we want the center to fade towards white, leaving the ring.
    
    vec3 finalObjectColor = sunColor;

    if (coreStrength < 0.3) {
        // We are in "Pale Center" mode
        // Calculate how much to whiten the center. 
        // The lower coreStrength is, the whiter the center.
        float hollowFactor = (0.3 - coreStrength) * 3.0; // Normalized 0-1
        hollowFactor = clamp(hollowFactor, 0.0, 1.0);
        
        // Mix the center of the object towards white
        // We use coreMask so only the center is affected, not the outer glow
        finalObjectColor = mix(finalObjectColor, bgColor, coreMask * hollowFactor * 0.9);
    }

    // Apply Grain to the object to make it feel material/misty
    float grain = random(uv + uTime) * 0.1;
    finalObjectColor += grain;

    // --- FINAL MIX ---

    // Mix object with background based on the body shape alpha
    // When misty, max opacity is lower to blend better
    float maxOpacity = 1.0 - (mistFactor * 0.3); 
    vec3 finalColor = mix(bgColor, finalObjectColor, body * maxOpacity);

    gl_FragColor = vec4(finalColor, 1.0);
}
