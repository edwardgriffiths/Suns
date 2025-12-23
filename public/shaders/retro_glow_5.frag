uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Random function for Grain
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Color Palette mixing function
vec3 getFilmColor(float t) {
    // Updated Palette: High Brightness/Saturation to avoid mud
    // 1. Hot Orange/Amber
    // 2. Vivid Magenta
    // 3. Electric Blue/Cyan
    // 4. Acid Yellow
    
    vec3 col1 = vec3(1.0, 0.4, 0.1);  
    vec3 col2 = vec3(0.9, 0.1, 0.6);   
    vec3 col3 = vec3(0.1, 0.7, 0.9);   
    vec3 col4 = vec3(1.0, 0.95, 0.2);   

    // FASTER cycling
    float cycle = sin(t) * 0.5 + 0.5; 
    float cycle2 = cos(t * 0.7) * 0.5 + 0.5;

    vec3 mixA = mix(col1, col2, cycle);
    vec3 mixB = mix(col3, col4, cycle2);
    
    // Mix
    vec3 finalCol = mix(mixA, mixB, sin(t * 0.5) * 0.5 + 0.5);

    // Anti-Mud: Vibrance Boost
    // Calculate luminance
    float lum = dot(finalCol, vec3(0.299, 0.587, 0.114));
    // Mix towards the color away from gray to boost saturation
    finalCol = mix(vec3(lum), finalCol, 1.4);
    
    return finalCol;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // --- MOVING LIGHT SOURCE MODEL ---
    
    // Create a wandering point for the "Hot Spot"
    // This is where new colors will appear to "spawn" or be brightest
    vec2 lightPos = vec2(0.5, 0.5);
    lightPos.x += sin(uTime * 0.4) * 0.35; // Wanders X
    lightPos.y += cos(uTime * 0.3) * 0.25; // Wanders Y

    float distFromLight = distance(uv, lightPos);
    
    // "Hot Spot" glow - centered on the wandering point
    float hotSpot = 1.0 - smoothstep(0.0, 1.2, distFromLight);
    
    // --- DYNAMIC COLOR ---

    // Base speed increased significantly
    float speed = uTime * 0.8;

    // Center Tone (At the light source): The "new" color
    vec3 sourceColor = getFilmColor(speed);
    
    // Ambient Tone (Far from light): The "fading" color (lagging behind in time)
    vec3 ambientColor = getFilmColor(speed - 1.5); 
    
    // Mix based on distance from the light source
    vec3 color = mix(sourceColor, ambientColor, smoothstep(0.1, 0.9, distFromLight));

    // --- LIGHTING & GLOW ---

    // Boost brightness at the light source
    color *= (0.8 + hotSpot * 0.6);

    // Re-apply Film Response Curve
    // Pushes values to extremes to keep it "glowing"
    color = pow(color, vec3(0.9)); // Gamma
    color = smoothstep(0.05, 1.05, color); // Contrast

    // --- TEXTURE ---

    // Flicker (kept smooth but present)
    float breathe = 1.0 + sin(uTime * 3.0) * 0.03; 
    color *= breathe;

    // Grain
    float grainStrength = 0.07;
    vec3 grain = vec3(
        random(uv + uTime),
        random(uv + uTime + 10.0),
        random(uv + uTime + 20.0)
    );
    color = mix(color, color * (0.8 + 1.4 * grain), grainStrength);

    // Vignette (Fixed to screen center, not light source, to frame the view)
    float vignette = smoothstep(1.4, 0.5, distance(uv, vec2(0.5)));
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
