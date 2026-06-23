/**
 * lensDistortion.js — vendored from ycw/three-lens-distortion (MIT © 2021 ycw)
 * https://github.com/ycw/three-lens-distortion
 *
 * Single-file copy of src/LensDistortionShader.js + src/LensDistortionPassGen.js,
 * vendored so the build stays hermetic (the package is GitHub-only, not on npm).
 *
 * `distortion` (uK0) is the radial coefficient: NEGATIVE = pincushion / inward
 * warp — the "inside-a-sphere" look. Applied as a post-process so the whole
 * composited scene (Tiles + World Shell) distorts cohesively.
 */

export const LensDistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uK0: { value: null }, // radial distortion coeff 0
    uCc: { value: null }, // principal point
    uFc: { value: null }, // focal length
    uAlpha_c: { value: 0 }, // skew coeff
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uK0;
    uniform vec2 uCc;
    uniform vec2 uFc;
    uniform float uAlpha_c;
    varying vec2 vUv;
    void main() {
      vec2 Xn = 2. * ( vUv.st - .5 ); // -1..1
      vec3 Xd = vec3(( 1. + uK0 * dot( Xn, Xn ) ) * Xn, 1.); // distorted
      mat3 KK = mat3(
        vec3(uFc.x, 0., 0.),
        vec3(uAlpha_c * uFc.x, uFc.y, 0.),
        vec3(uCc.x, uCc.y, 1.)
      );
      vec2 Xp = ( KK * Xd ).xy * .5 + .5; // projected; into 0..1
      if ( Xp.x >= 0. && Xp.x <= 1. && Xp.y >= 0. && Xp.y <= 1. ) {
        gl_FragColor = texture2D( tDiffuse, Xp );
      }
    }
  `,
};

export function LensDistortionPassGen({ THREE, Pass, FullScreenQuad }) {
  return class LensDistortionPass extends Pass {
    constructor({
      distortion = new THREE.Vector2(0, 0),
      principalPoint = new THREE.Vector2(0, 0),
      focalLength = new THREE.Vector2(1, 1),
      skew = 0,
    } = {}) {
      super();

      this._fsQuad = new FullScreenQuad(
        new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(LensDistortionShader.uniforms),
          vertexShader: LensDistortionShader.vertexShader,
          fragmentShader: LensDistortionShader.fragmentShader,
        })
      );

      this._fsQuad.material.uniforms.uK0.value = distortion;
      this._fsQuad.material.uniforms.uCc.value = principalPoint;
      this._fsQuad.material.uniforms.uFc.value = focalLength;
      this._fsQuad.material.uniforms.uAlpha_c.value = skew;

      this._uniforms = this._fsQuad.material.uniforms;
    }

    render(renderer, writeBuffer, readBuffer) {
      this._fsQuad.material.uniforms.tDiffuse.value = readBuffer.texture;
      if (this.renderToScreen) {
        renderer.setRenderTarget(null);
      } else {
        renderer.setRenderTarget(writeBuffer);
        if (this.clear) renderer.clear();
      }
      this._fsQuad.render(renderer);
    }

    dispose() {
      this._fsQuad.material.dispose();
      this._fsQuad.dispose();
    }

    get distortion() {
      return this._uniforms.uK0.value;
    }
    set distortion(value) {
      this._uniforms.uK0.value = value;
    }
    get principalPoint() {
      return this._uniforms.uCc.value;
    }
    set principalPoint(value) {
      this._uniforms.uCc.value = value;
    }
    get focalLength() {
      return this._uniforms.uFc.value;
    }
    set focalLength(value) {
      this._uniforms.uFc.value = value;
    }
    get skew() {
      return this._uniforms.uAlpha_c.value;
    }
    set skew(value) {
      this._uniforms.uAlpha_c.value = value;
    }
  };
}
