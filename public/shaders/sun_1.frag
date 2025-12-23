uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Retro Sun Color Palette
vec3 getSunColor(float t) {
    // Warm, Retro Sunset Palette
    vec3 core = vec3(1.0, 0.9, 0.4);   // Bright Yellow-White Core
    vec3 inner = vec3(1.0, 0.6, 0.1);  // Warm Orange
    vec3 outer = vec3(0.9, 0.2, 0.5);  // Pinkish-Red Edge
    vec3 glow = vec3(0.6, 0.1, 0.8);   // Deep Magenta Glow

    float cycle = sin(t * 0.5) * 0.5 + 0.5; // Slow color shift cycle
    
    // Mix colors based on time and a gradient for a core-to-edge effect
    vec3 col = mix(core, inner, cycle);
    col = mix(col, outer, smoothstep(0.2, 0.8, cycle));
    col = mix(col, glow, smoothstep(0.6, 1.0, cycle));
    
    return col;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Center the coordinate system
    vec2 centeredUv = uv - 0.5;

    // Correct for aspect ratio to get a perfect circle
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    float dist = length(centeredUv);
    
    // --- SUN & GLOW MODEL ---
    
    // Breathing effect for the sun's size and intensity
    float breath = sin(uTime * 0.8) * 0.05 + 1.0;
    
    // Core of the sun
    float coreRadius = 0.2 * breath;
    float sunCore = 1.0 - smoothstep(coreRadius * 0.8, coreRadius, dist);
    
    // Soft, wide glow around the sun
    float glowRadius = 0.6 * breath;
    float sunGlow = 1.0 - smoothstep(coreRadius, glowRadius, dist);
    
    // Combine core and glow, with the core being much brighter
    float sunMask = sunCore * 2.0 + sunGlow * 0.8;
    
    // Get the shifting retro color
    vec3 sunColor = getSunColor(uTime * 0.3); // Slower color shift
    
    // --- COMPOSITION ---
    
    // White background
    vec3 bgColor = vec3(1.0, 1.0, 1.0);
    
    // Mix the sun color with the background based on the mask
    // Using a power function on the mask to make the glow softer
    vec3 finalColor = mix(bgColor, sunColor, pow(sunMask, 1.5));
    
    // Clamp the color to prevent over-bright artifacts
    finalColor = clamp(finalColor, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
}
