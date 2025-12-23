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

// Palette Generator
vec3 getPaletteColor(float t) {
    vec3 c1 = vec3(1.0, 0.4, 0.2); // Red-Orange
    vec3 c2 = vec3(1.0, 0.8, 0.1); // Golden Yellow
    vec3 c3 = vec3(0.2, 0.6, 0.9); // Sky Blue
    vec3 c4 = vec3(0.8, 0.2, 0.8); // Magenta
    
    float cycle = fract(t);
    // Smooth blending between 4 colors
    if(cycle < 0.25) return mix(c1, c2, cycle * 4.0);
    if(cycle < 0.50) return mix(c2, c3, (cycle - 0.25) * 4.0);
    if(cycle < 0.75) return mix(c3, c4, (cycle - 0.50) * 4.0);
    return mix(c4, c1, (cycle - 0.75) * 4.0);
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

    // --- COLOR DYNAMICS (Split Inner/Outer) ---
    
    // We sample the palette at two different times to get contrasting colors
    float timeScale = uTime * 0.15;
    vec3 innerColor = getPaletteColor(timeScale);
    vec3 outerColor = getPaletteColor(timeScale + 0.35); // Offset creates the difference

    // --- SHAPE & DISTORTION ---

    float tMist = uTime * 0.1; 
    float mistFactor = smoothstep(-0.4, 0.8, sin(tMist)); // 0 = sharp, 1 = misty

    // Generate noise
    float n = noise(centeredUv * 2.5 + uTime * 0.15);
    
    // Distortion amount increases with mist
    float distortion = (n - 0.5) * (0.05 + mistFactor * 0.12);
    
    float dist = length(centeredUv) + distortion;

    // --- MASKS & CONTAINMENT ---
    
    // Base radius
    float radius = 0.22 + sin(uTime * 0.5) * 0.02;
    
    // Softness expands with mist, BUT we must clamp it to avoid edge spill.
    // Max available space from center to nearest edge is 0.5.
    // We want everything to fade out by 0.45 to be safe.
    float maxExtent = 0.45;
    
    // Calculate softness based on mist, but keep it constrained
    float softness = 0.1 + mistFactor * 0.3; // Can go up to 0.4 total size approx
    
    // Ensure the fade-out completes before the screen edge
    float outerLimit = radius + softness;
    if (outerLimit > maxExtent) {
       // If logic pushes it too wide, tighten the softness
       softness = maxExtent - radius;
    }

    // Main object body
    float bodyAlpha = 1.0 - smoothstep(radius, radius + softness, dist);
    
    // Inner Core Mask (for color blending)
    float coreMask = 1.0 - smoothstep(0.0, radius * 1.5, dist); // Soft gradient from center

    // --- CORE VARIANCE (Hollow/Solid) ---
    
    float tCore = uTime * 0.2 + 10.0;
    float solidCoreStrength = sin(tCore) * 0.5 + 0.5; // 0 to 1
    
    // Logic: Sometimes the center is white (hollow), sometimes it's the innerColor.
    // We mix the innerColor towards white based on this strength.
    vec3 centerFill = innerColor;
    if (solidCoreStrength < 0.4) {
            float hollowness = (0.4 - solidCoreStrength) * 2.5; // Normalized 0-1
            centerFill = mix(innerColor, vec3(1.0), hollowness * coreMask); 
    }

    // --- COLOR MIXING ---
    
    // Mix Inner and Outer colors based on distance
    // We use the coreMask to keep innerColor near the center and outerColor at edges
    vec3 objectColor = mix(outerColor, centerFill, coreMask);
    
    // Add grain
    objectColor += (random(uv + uTime) - 0.5) * 0.1;

    // --- FINAL SAFETY CLAMP ---
    
    // Hard safety fade to ensure absolutely no spill at 0.5 distance
    float safeZone = 1.0 - smoothstep(0.42, 0.49, length(centeredUv));
    bodyAlpha *= safeZone;

    // --- COMPOSITION ---
    
    vec3 bgColor = vec3(1.0);
    
    // Fade mistier objects more to blend better
    float mistOpacity = 1.0 - (mistFactor * 0.2);
    
    vec3 finalColor = mix(bgColor, objectColor, bodyAlpha * mistOpacity);

    gl_FragColor = vec4(finalColor, 1.0);
}
