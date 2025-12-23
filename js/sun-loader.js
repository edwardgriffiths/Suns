/**
 * Shared loader for Sun visualizers.
 * Standardizes initialization, shader loading, and uniform management.
 * 
 * Usage from HTML:
 * initSunVisualizer({
 *   vertexShaderPath: 'shaders/sun_N.vert',
 *   fragmentShaderPath: 'shaders/sun_N.frag',
 *   vertexShaderId: 'vertexShader',   // Optional: if loading from script tag (legacy support)
 *   fragmentShaderId: 'fragmentShader' // Optional: if loading from script tag (legacy support)
 * });
 */

let scene, camera, renderer, uniforms;

async function initSunVisualizer(config) {
    const loading = document.getElementById('loading');

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);

    uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    try {
        let vertexShader, fragmentShader;

        if (config.vertexShaderPath && config.fragmentShaderPath) {
            // Load from external files
            [vertexShader, fragmentShader] = await Promise.all([
                fetch(config.vertexShaderPath).then(res => res.text()),
                fetch(config.fragmentShaderPath).then(res => res.text())
            ]);
        } else if (config.vertexShaderId && config.fragmentShaderId) {
            // Load from DOM elements (Legacy/Fallback)
            vertexShader = document.getElementById(config.vertexShaderId).textContent;
            fragmentShader = document.getElementById(config.fragmentShaderId).textContent;
        } else {
            throw new Error("Invalid configuration: Missing shader paths or IDs");
        }

        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: uniforms
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        if (loading) loading.style.display = 'none';

        renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        window.addEventListener('resize', onWindowResize, false);

        animate(0);

    } catch (error) {
        console.error(error);
        if (loading) loading.textContent = 'Error loading shaders: ' + error.message;
    }
}

function onWindowResize() {
    if (renderer && uniforms) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.uResolution.value.x = window.innerWidth;
        uniforms.uResolution.value.y = window.innerHeight;
    }
}

function animate(time) {
    requestAnimationFrame(animate);
    if (time === undefined) time = 0;
    if (uniforms) {
        uniforms.uTime.value = time * 0.001;
    }
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
