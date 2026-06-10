/*
 * Сцена аптеки на Three.js для тренажёра «Супрадин».
 * Строит интерьер от первого лица за стойкой, низкополигональных
 * посетителей и анимации: вход, ожидание, реакции (кивок/качание
 * головой), уход. UI-логика живёт отдельно в game.js.
 */
import * as THREE from "three";

const ORANGE = 0xf39200;
const AMBER = 0xffb22e;

export class PharmacyScene {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.visitor = null;
    this.state = "empty"; // empty | entering | idle | leaving
    this._pending = null; // resolve-колбэк для завершения перехода
    this.react = null; // {type, t, dur}
    this.walkPhase = 0;

    this._initRenderer();
    this._initScene();
    this._buildRoom();
    this._buildCounter();
    this._buildShelves();
    this._buildLights();

    window.addEventListener("resize", () => this._resize());
    this._resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  /* ---------- базовая инициализация ---------- */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef3f7);
    this.scene.fog = new THREE.Fog(0xeef3f7, 16, 34);

    // Камера от первого лица за стойкой, смотрит к входу (−Z)
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, 1.62, 6.2);
    this.camLookAt = new THREE.Vector3(0, 1.35, -2);
    this.camera.lookAt(this.camLookAt);
  }

  /* ---------- интерьер ---------- */
  _buildRoom() {
    const W = 16, D = 20, H = 5;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 1 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, -2);
    this.scene.add(ceil);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.95 });
    // боковые стены
    const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-W / 2, H / 2, -2);
    left.receiveShadow = true;
    this.scene.add(left);
    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.set(W / 2, H / 2, -2);
    this.scene.add(right);

    // задняя стена со «стеклянным входом» (за спиной посетителя, у −Z)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    back.position.set(0, H / 2, -12);
    this.scene.add(back);

    // витрина-окно: яркая голубая панель = дневной свет с улицы
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 3.4),
      new THREE.MeshBasicMaterial({ color: 0xbfe0f5 })
    );
    glass.position.set(0, 2.0, -11.92);
    this.scene.add(glass);
    // рамы окна
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4452, roughness: 0.6, metalness: 0.3 });
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4, 0.08), frameMat);
      bar.position.set(i * 2.2, 2.0, -11.88);
      this.scene.add(bar);
    }

    // потолочное кольцо-светильник (как на витрине)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.07, 12, 60),
      new THREE.MeshBasicMaterial({ color: 0xfff4d6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, H - 0.25, -2);
    this.scene.add(ring);
  }

  _buildCounter() {
    const top = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 });
    const body = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.6 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.05, 1.3), body);
    base.position.set(0, 0.53, 4.4);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.12, 1.6), top);
    counterTop.position.set(0, 1.12, 4.4);
    counterTop.castShadow = true;
    this.scene.add(counterTop);

    // платёжный терминал на стойке
    const term = new THREE.Group();
    const termBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.07, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.5 })
    );
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.02, 0.3),
      new THREE.MeshBasicMaterial({ color: AMBER })
    );
    screen.position.set(0, 0.05, -0.05);
    term.add(termBody, screen);
    term.position.set(-2.4, 1.22, 4.2);
    term.rotation.x = -0.5;
    this.scene.add(term);

    // мини-логотип «солнце» на фронте стойки
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 24),
      new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.35, roughness: 0.5 })
    );
    sun.position.set(0, 0.6, 5.06);
    this.scene.add(sun);
  }

  _buildShelves() {
    this.boxGeo = new THREE.BoxGeometry(0.38, 0.5, 0.26);
    // палитра упаковок «Супрадин» — оранжево-жёлтая гамма
    const palette = [0xf39200, 0xffa51f, 0xffb22e, 0xe07b00, 0xffc14d];
    this.boxMats = palette.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })
    );
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });

    const makeWall = (sideX) => {
      const group = new THREE.Group();
      const rows = [1.4, 2.15, 2.9, 3.65];
      rows.forEach((y) => {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 8.5), shelfMat);
        shelf.position.set(0, y, -3);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        group.add(shelf);
        for (let i = 0; i < 16; i++) {
          const box = new THREE.Mesh(this.boxGeo, this.boxMats[(i + Math.round(y)) % this.boxMats.length]);
          box.position.set((Math.random() - 0.5) * 0.12, y + 0.28, -6.7 + i * 0.5);
          box.rotation.y = sideX < 0 ? Math.PI / 2 : -Math.PI / 2;
          box.castShadow = true;
          group.add(box);
        }
      });
      group.position.x = sideX;
      // полки слегка повёрнуты к покупателю
      group.rotation.y = sideX < 0 ? 0.04 : -0.04;
      this.scene.add(group);
    };
    makeWall(-7.4);
    makeWall(7.4);

    // подсветка полок (тёплые полосы)
    [-7.0, 7.0].forEach((x) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.03, 8.5),
        new THREE.MeshBasicMaterial({ color: 0xfff1cf })
      );
      strip.position.set(x, 4.05, -3);
      this.scene.add(strip);
    });
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdadfe3, 0.85));

    const key = new THREE.DirectionalLight(0xfff3df, 1.05);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -6;
    this.scene.add(key);

    const fill = new THREE.PointLight(0xffe7c2, 0.6, 30);
    fill.position.set(0, 4.4, -2);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xbfe0f5, 0.5, 25);
    rim.position.set(0, 3, -9);
    this.scene.add(rim);
  }

  /* ---------- посетитель ---------- */
  _buildVisitor(look) {
    const g = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: look.cloth, roughness: 0.85 });
    const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.9 });

    // торс
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.62, 6, 12), clothMat);
    torso.position.y = 1.18;
    torso.castShadow = true;
    g.add(torso);

    // «беременный» животик
    if (look.pregnant) {
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), clothMat);
      belly.position.set(0, 1.04, 0.22);
      belly.scale.set(1, 0.9, 0.85);
      belly.castShadow = true;
      g.add(belly);
    }

    // шея + голова
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), skinMat);
    neck.position.y = 1.6;
    g.add(neck);

    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 20), skinMat);
    skull.castShadow = true;
    head.add(skull);

    // глаза
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.4 });
    const eyeGeo = new THREE.SphereGeometry(0.032, 8, 8);
    [-0.085, 0.085].forEach((x) => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 0.03, 0.205);
      head.add(eye);
    });

    // волосы
    if (look.hairStyle !== "bald") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.252, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
      cap.position.y = 0.02;
      head.add(cap);
      if (look.hairStyle === "long") {
        const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 4, 10), hairMat);
        back.position.set(0, -0.16, -0.12);
        back.scale.set(1.1, 1, 0.7);
        head.add(back);
      } else if (look.hairStyle === "bun") {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), hairMat);
        bun.position.set(0, 0.16, -0.2);
        head.add(bun);
      }
    }
    // борода
    if (look.beard) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), hairMat);
      beard.position.set(0, -0.04, 0.02);
      beard.scale.set(1, 1, 1.05);
      head.add(beard);
    }

    head.position.y = 1.78;
    g.add(head);
    this._head = head;

    // руки
    const armGeo = new THREE.CapsuleGeometry(0.085, 0.5, 4, 8);
    const armL = new THREE.Mesh(armGeo, clothMat);
    armL.position.set(-0.4, 1.2, 0);
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.4;
    g.add(armL, armR);
    this._arms = [armL, armR];

    // ноги
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.62, 4, 8);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.16, 0.5, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legL, legR);
    this._legs = [legL, legR];

    return g;
  }

  /* Появление нового посетителя: вход от двери к стойке. */
  spawnVisitor(look) {
    if (this.visitor) {
      this.scene.remove(this.visitor);
      this.visitor.traverse((o) => {
        if (o.isMesh && o.geometry !== this.boxGeo) o.geometry.dispose();
      });
    }
    this.visitor = this._buildVisitor(look);
    this.visitor.position.set(0, 0, -8.5);
    this.visitor.rotation.y = 0; // лицом к стойке (+Z, к камере)
    this._setOpacity(0);
    this.scene.add(this.visitor);

    this.state = "entering";
    this.fadeIn = 0;
    return new Promise((res) => (this._pending = res));
  }

  /* Кивок одобрения (верный ответ). */
  reactCorrect() {
    return this._doReact("nod", 1.1);
  }
  /* Качание головой (неверный ответ). */
  reactWrong() {
    return this._doReact("shake", 1.1);
  }
  _doReact(type, dur) {
    this.react = { type, t: 0, dur };
    return new Promise((res) => (this._reactDone = res));
  }

  /* Уход посетителя к двери. */
  dismissVisitor() {
    if (!this.visitor) return Promise.resolve();
    this.state = "leaving";
    this.visitor.rotation.y = Math.PI; // развернуться к двери
    return new Promise((res) => (this._pending = res));
  }

  _setOpacity(v) {
    if (!this.visitor) return;
    this.visitor.traverse((o) => {
      if (o.isMesh) {
        o.material.transparent = v < 1;
        o.material.opacity = v;
      }
    });
  }

  /* ---------- цикл анимации ---------- */
  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.visitor) {
      const stopZ = 3.0; // у стойки, лицом к фармацевту
      if (this.state === "entering") {
        this.fadeIn = Math.min(1, this.fadeIn + dt * 1.6);
        this._setOpacity(this.fadeIn);
        this.visitor.position.z += dt * 2.4;
        this._walk(dt, 1);
        if (this.visitor.position.z >= stopZ) {
          this.visitor.position.z = stopZ;
          this._resetLimbs();
          this.state = "idle";
          if (this._pending) { this._pending(); this._pending = null; }
        }
      } else if (this.state === "leaving") {
        this.visitor.position.z -= dt * 2.6;
        this._walk(dt, 1);
        if (this.visitor.position.z < -8.5) {
          this.scene.remove(this.visitor);
          this.visitor = null;
          this.state = "empty";
          if (this._pending) { this._pending(); this._pending = null; }
        }
      } else if (this.state === "idle") {
        // лёгкое дыхание
        this.visitor.position.y = Math.sin(t * 1.6) * 0.012;
      }

      // реакции головой
      if (this.react && this._head) {
        this.react.t += dt;
        const p = this.react.t / this.react.dur;
        const wave = Math.sin(p * Math.PI * 3) * (1 - p);
        if (this.react.type === "nod") this._head.rotation.x = wave * 0.5;
        else this._head.rotation.y = wave * 0.6;
        if (p >= 1) {
          this._head.rotation.set(0, 0, 0);
          this.react = null;
          if (this._reactDone) { this._reactDone(); this._reactDone = null; }
        }
      }
    }

    // живая камера: едва заметное покачивание
    this.camera.position.x = Math.sin(t * 0.4) * 0.04;
    this.camera.position.y = 1.62 + Math.sin(t * 0.7) * 0.015;
    this.camera.lookAt(this.camLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  _walk(dt, speed) {
    this.walkPhase += dt * 8 * speed;
    const s = Math.sin(this.walkPhase) * 0.5;
    if (this._legs) {
      this._legs[0].rotation.x = s;
      this._legs[1].rotation.x = -s;
    }
    if (this._arms) {
      this._arms[0].rotation.x = -s * 0.7;
      this._arms[1].rotation.x = s * 0.7;
    }
  }
  _resetLimbs() {
    if (this._legs) this._legs.forEach((l) => (l.rotation.x = 0));
    if (this._arms) this._arms.forEach((a) => (a.rotation.x = 0));
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* Экранная позиция головы посетителя — для «облачка» с речью. */
  visitorScreenPos() {
    if (!this.visitor || this.state !== "idle") return null;
    const v = new THREE.Vector3(0, 2.1, 0);
    this.visitor.localToWorld(v);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.container.clientHeight,
      visible: v.z < 1,
    };
  }
}
