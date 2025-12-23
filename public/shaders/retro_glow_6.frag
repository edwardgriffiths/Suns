uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// Random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 2D Noise for subtle field variation
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

// Color Palette mixing function
vec3 getFilmColor(float t) {
    // Bright, Retro Palette
    vec3 col1 = vec3(1.0, 0.4, 0.1);  // Hot Orange
    vec3 col2 = vec3(0.9, 0.1, 0.6);  // Magenta
    vec3 col3 = vec3(0.1, 0.7, 0.9);  // Cyan
    vec3 col4 = vec3(1.0, 0.95, 0.2); // Yellow

    float cycle = sin(t) * 0.5 + 0.5; 
    float cycle2 = cos(t * 0.7) * 0.5 + 0.5;

    vec3 mixA = mix(col1, col2, cycle);
    vec3 mixB = mix(col3, col4, cycle2);
    
    vec3 finalCol = mix(mixA, mixB, sin(t * 0.5) * 0.5 + 0.5);

    // Anti-Mud: Vibrance Boost
    float lum = dot(finalCol, vec3(0.299, 0.587, 0.114));
    finalCol = mix(vec3(lum), finalCol, 1.3);
    
    return finalCol;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Slow time down for gentle shifts (0.15 speed)
    float slowTime = uTime * 0.15; 

    // --- BREATHING FIELD MODEL ---
    
    float dist = distance(uv, vec2(0.5));
    
    // Irregular Field Shape
    float fieldShape = dist + noise(uv * 1.5 + slowTime * 0.1) * 0.15;

    // Color 1: The "Core" State (Center)
    vec3 colCore = getFilmColor(slowTime);
    
    // Color 2: The "Incoming" State (Edges/Future)
    vec3 colEdge = getFilmColor(slowTime + 1.2);

    // The "Tide": Oscillates slowly
    float tide = sin(slowTime * 0.5); 
    
    // Create a soft, wide gradient mask based on the tide
    float mask = smoothstep(0.2 - tide * 0.4, 1.2 + tide * 0.4, fieldShape);
    
    // Mix the two color states based on the breathing mask
    vec3 color = mix(colCore, colEdge, mask);

    // --- LIGHTING & GLOW ---

    // General center glow
    float hotSpot = 1.0 - smoothstep(0.0, 1.6, dist);
    color *= (0.85 + hotSpot * 0.4);

    // Film Curve (Contrast)
    color = pow(color, vec3(0.9)); 
    color = smoothstep(0.0, 1.05, color); 

    // --- TEXTURE ---

    // Subtle Pulse
    float pulse = 1.0 + sin(uTime * 2.0) * 0.02; 
    color *= pulse;

    // Grain
    float grainStrength = 0.07;
    vec3 grain = vec3(
        random(uv + uTime),
        random(uv + uTime + 10.0),
        random(uv + uTime + 20.0)
    );
    color = mix(color, color * (0.8 + 1.4 * grain), grainStrength);

    // Vignette
    float vignette = smoothstep(1.5, 0.4, dist);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
