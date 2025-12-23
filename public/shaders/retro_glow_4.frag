uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Random function for Grain
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Color Palette mixing function
// Smoother, deeper transitions
vec3 getFilmColor(float t) {
    // A palette of "Hot" Retro Colors:
    // 1. Deep Amber/Orange (Tungsten light)
    // 2. Faded Magenta (Aged film)
    // 3. Chemical Teal (Technicolor shadow)
    // 4. Blown-out White/Yellow (Overexposure)
    
    vec3 col1 = vec3(1.0, 0.35, 0.05); // Hot Amber
    vec3 col2 = vec3(0.8, 0.1, 0.3);   // Deep Red/Magenta
    vec3 col3 = vec3(0.1, 0.6, 0.7);   // Retro Teal
    vec3 col4 = vec3(1.0, 0.9, 0.7);   // Warm White

    // Extended, very slow cycles (Meditation speed)
    float cycle = sin(t * 0.1) * 0.5 + 0.5; 
    float cycle2 = cos(t * 0.07) * 0.5 + 0.5;

    vec3 mixA = mix(col1, col2, cycle);
    vec3 mixB = mix(col3, col4, cycle2);
    
    // Final blend
    return mix(mixA, mixB, sin(t * 0.05) * 0.5 + 0.5);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // --- LIGHT DISTRIBUTION MODEL ---
    
    // 1. Calculate physical screen falloff
    float distFromCenter = distance(uv, vec2(0.5));
    
    // "Hot Spot": The center is naturally brighter (projector bulb intensity)
    // Smoothstep creates a soft edge to the light source
    float hotSpot = 1.0 - smoothstep(0.0, 1.4, distFromCenter);
    
    // 2. Tonal Variation (Gradient)
    // Instead of one flat color, we generate two slightly shifted tones
    // The Center gets the "pure" time color.
    // The Edges get a color from slightly further in the timeline (offset by 0.5s)
    // This creates a subtle hue shift from center to corner (e.g., Amber center -> Red edge)
    vec3 centerTone = getFilmColor(uTime * 0.1);
    vec3 edgeTone = getFilmColor(uTime * 0.1 + 0.5); 
    
    // Mix them based on distance. 
    // Center is pure centerTone, Edges drift 40% towards edgeTone.
    vec3 color = mix(centerTone, edgeTone, distFromCenter * 0.4);

    // 3. Apply Light Physics
    // Boost brightness in the center, allow natural falloff
    color *= (0.7 + hotSpot * 0.5);

    // 4. Film Response Curve (Smoother)
    // We use a gamma curve to simulate film response, but less aggressive than before.
    color = pow(color, vec3(0.95)); 
    
    // 5. Reduced Flicker (The "Breath")
    // Replaced the jagged random flicker with a slow sine wave
    float breathe = 1.0 + sin(uTime * 0.6) * 0.015; // Very slow bulb fluctuation
    float microFlicker = (random(vec2(uTime, 0.0)) - 0.5) * 0.005; // Tiny organic variance
    color *= (breathe + microFlicker);

    // 6. Fine Film Grain
    // Softer than before, blending more naturally
    float grainStrength = 0.08;
    vec3 grain = vec3(
        random(uv + uTime),
        random(uv + uTime + 10.0),
        random(uv + uTime + 20.0)
    );
    // Blend grain using a method that preserves luminance
    color = mix(color, color * (0.85 + 1.3 * grain), grainStrength);

    // 7. Cinema Vignette
    // Soft darkness at the very edges of the screen
    float vignette = smoothstep(1.3, 0.4, distFromCenter);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
