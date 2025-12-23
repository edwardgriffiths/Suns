/**
 * Shared Three.js Visualizer Module
 */

export async function createVisualizer({ vertexPath, fragmentPath, onInit }) {
    let scene, camera, renderer, uniforms;

    try {
        // Fetch external shaders
        const [vertexShader, fragmentShader] = await Promise.all([
            fetch(vertexPath).then(r => r.text()),
            fetch(fragmentPath).then(r => r.text())
        ]);

        // Remove loading text
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const geometry = new THREE.PlaneGeometry(2, 2);

        uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        // Call individual init hook if provided
        if (onInit) {
            onInit(uniforms);
        }

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniforms.uResolution.value.x = window.innerWidth;
            uniforms.uResolution.value.y = window.innerHeight;
        }, false);

        return { scene, camera, renderer, uniforms };
    } catch (error) {
        console.error("Failed to load shaders:", error);
        const loading = document.getElementById('loading');
        if (loading) loading.textContent = "Error: Shader Load Failed.";
        throw error;
    }
}

export function runAnimation(visualizer, update) {
    function animate(time) {
        requestAnimationFrame(animate);
        const t = (time || 0) * 0.001;

        if (visualizer.uniforms) {
            visualizer.uniforms.uTime.value = t;
        }

        if (update) {
            update(t);
        }

        visualizer.renderer.render(visualizer.scene, visualizer.camera);
    }
    animate(0);
}
