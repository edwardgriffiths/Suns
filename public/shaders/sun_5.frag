uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

// --- NOISE FUNCTIONS ---
// Using noise to create "clouds" rather than geometry

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

// Fractal Brownian Motion: Smoother, cloudier noise
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- COLOR PALETTES ---

vec3 getPalette(float t) {
    // Fresh, Vibrant, but soft inputs
    vec3 c1 = vec3(1.0, 0.4, 0.2); // Soft Orange
    vec3 c2 = vec3(1.0, 0.8, 0.5); // Peach/Gold
    vec3 c3 = vec3(0.4, 0.6, 1.0); // Periwinkle Blue
    vec3 c4 = vec3(0.9, 0.3, 0.7); // Orchid
    
    float cycle = fract(t * 0.1); // Very slow drift
    
    if(cycle < 0.25) return mix(c1, c2, cycle * 4.0);
    if(cycle < 0.50) return mix(c2, c3, (cycle - 0.25) * 4.0);
    if(cycle < 0.75) return mix(c3, c4, (cycle - 0.50) * 4.0);
    return mix(c4, c1, (cycle - 0.75) * 4.0);
}

vec3 getDeepPalette(float t) {
    vec3 c1 = vec3(0.6, 0.1, 0.3); // Deep Berry
    vec3 c2 = vec3(0.2, 0.2, 0.5); // Deep Indigo
    return mix(c1, c2, sin(t * 0.2) * 0.5 + 0.5);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 centeredUv = uv - 0.5;
    
    if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
    } else {
        centeredUv.y *= uResolution.y / uResolution.x;
    }

    // --- VAPOROUS SHAPE ---
    
    // Instead of a hard radius, we use a radial falloff modified by noise.
    // This creates the "indistinct mist" that stays roughly spherical.
    
    float baseDist = length(centeredUv);
    
    // We distort the lookup coordinate for the noise, not the shape itself
    // This makes the internal colors swirl like gas
    float flow = fbm(centeredUv * 3.0 - vec2(0.0, uTime * 0.1)); 
    
    // Determine density (Alpha)
    // Start with a soft circle (0.4 radius fading to 0.0)
    float density = smoothstep(0.45, 0.1, baseDist);
    
    // Erode the density with noise to make it misty
    // The further from center, the more the noise eats away (misty edges)
    float erosion = fbm(centeredUv * 4.0 + uTime * 0.15);
    density *= (0.6 + 0.6 * erosion); // Modulate density
    
    // --- COLOR MIXING ---
    
    // Get two drifting colors
    vec3 colA = getPalette(uTime + flow * 0.5);
    vec3 colB = getPalette(uTime + 0.5 + flow * 0.5);
    
    // Intense/Deep Cycle (Occasional)
    float deepCycle = smoothstep(0.6, 0.9, sin(uTime * 0.1));
    vec3 colDeep = getDeepPalette(uTime);
    
    // Mix base colors using noise, avoiding concentric rings
    // We use the 'flow' value to mix, creating organic patches
    vec3 finalColor = mix(colA, colB, flow);
    
    // Apply deep cycle (darker, richer moments)
    finalColor = mix(finalColor, colDeep, deepCycle * 0.6);

    // --- SOFT FLARES / GLARES ---
    // Interpreted as "blooms" of light, not shapes.
    // We create a large, low-frequency noise blob that adds brightness/color
    
    float flareNoise = noise(centeredUv * 1.5 + vec2(uTime * 0.2));
    float flareMask = smoothstep(0.4, 0.8, flareNoise); // Only peaks
    
    // "Glare" color is usually a bright variant of the current palette or white
    vec3 glareColor = mix(colA, vec3(1.0), 0.7); 
    
    // Additive blending for the glare, softened by density so it doesn't float in void
    finalColor += glareColor * flareMask * 0.4 * density;

    // --- CENTER EMPHASIS (OPTIONAL) ---
    // Sometimes the center is hot, sometimes pale.
    // We use a very soft radial gradient for this.
    float coreHeat = smoothstep(0.5, 0.0, baseDist);
    float pulse = sin(uTime * 0.5) * 0.5 + 0.5; // 0 to 1
    
    // Subtle brightening of core based on pulse
    finalColor += vec3(0.1, 0.1, 0.0) * coreHeat * pulse;

    // --- CONTAINMENT ---
    
    // Hard limit to white at the edges.
    // We fade the DENSITY to 0 before it hits the screen edge.
    float safetyFade = smoothstep(0.48, 0.35, baseDist); 
    density *= safetyFade;

    // --- COMPOSITION ---
    
    vec3 bg = vec3(1.0); // White
    
    // Mix based on density. 
    // Clamp density to ensure we don't get negative values or over 1
    density = clamp(density, 0.0, 1.0);
    
    vec3 composited = mix(bg, finalColor, density);
    
    // Final soft clamp
    composited = clamp(composited, 0.0, 1.0);

    gl_FragColor = vec4(composited, 1.0);
}
