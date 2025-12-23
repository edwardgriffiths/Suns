uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Random function for Grain
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Color Palette mixing function
// We avoid "patterns" by mixing purely based on Time, not Space (UV)
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

    // Slow, breathing cycles
    float cycle = sin(t * 0.5) * 0.5 + 0.5; // 0.0 to 1.0
    float cycle2 = cos(t * 0.3) * 0.5 + 0.5;

    // Mix them in a non-linear way to feel organic
    vec3 mixA = mix(col1, col2, cycle);
    vec3 mixB = mix(col3, col4, cycle2);
    
    // Final blend based on a third wave
    return mix(mixA, mixB, sin(t * 0.2) * 0.5 + 0.5);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // 1. Base Color Field
    // No spatial noise, no swirls. Just a subtle gradient to mimic a light source.
    // We make the center slightly brighter to simulate a projector bulb (Hot Spot).
    float centerDist = distance(uv, vec2(0.5));
    float lightFalloff = 1.0 - smoothstep(0.2, 1.5, centerDist);
    
    // Get the current color from our time-based palette
    vec3 color = getFilmColor(uTime * 0.4);

    // 2. The "Glow" (Halation & Exposure)
    // We boost the brightness based on the falloff, then clip it.
    // This makes the color feel "thick" and luminescent.
    color *= (0.8 + lightFalloff * 0.4); 

    // Apply a "Hot" curve - pushes mids to highs, crushing blacks slightly
    // This simulates high-contrast reversal film.
    color = pow(color, vec3(0.9)); // Gamma
    color = smoothstep(0.0, 1.1, color); // Contrast boost

    // 3. Projector Flicker
    // Subtle 24fps-style flickering amplitude
    float flicker = 1.0 + (random(vec2(uTime, 0.0)) - 0.5) * 0.03;
    color *= flicker;

    // 4. Heavy Film Grain
    // We use RGB noise instead of monochrome to make it feel like dye clouds.
    float grainStrength = 0.12;
    vec3 grain = vec3(
        random(uv + uTime),
        random(uv + uTime + 10.0),
        random(uv + uTime + 20.0)
    );
    
    // Overlay grain (Soft Light blend mode approximation)
    color = mix(color, color * (0.5 + 2.0 * grain), grainStrength);

    // 5. Gate Vignette
    // Darken the extreme corners very slightly
    float vignette = smoothstep(1.2, 0.5, distance(uv, vec2(0.5)));
    color *= mix(1.0, vignette, 0.3);

    gl_FragColor = vec4(color, 1.0);
}
