// Unknown, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />
/// <reference path="flycam.ts" />
/// <reference path="assets.ts" />

import io = sd.io;
import math = sd.math;
import world = sd.world;
import render = sd.render;
import meshdata = sd.meshdata;
import dom = sd.dom;
import asset = sd.asset;
import container = sd.container;
import audio = sd.audio;

import vec2 = veclib.vec2;
import vec3 = veclib.vec3;
import vec4 = veclib.vec4;
import quat = veclib.quat;
import mat2 = veclib.mat2;
import mat3 = veclib.mat3;
import mat4 = veclib.mat4;

const enum GameMode {
	None,
	Loading,
	Title,
	Start,
	Main,
	End
}


const enum KeyCommand {
	DooEet
}


class MainScene implements sd.SceneController {
	private scene_: world.Scene;
	private assets_: Assets;

	private flyCam_: FlyCamController;

	private skyBox_: world.Skybox;
	private spotLight_: world.LightInstance;

	private mode_ = GameMode.None;


	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		this.scene_ = new world.Scene(rc);
		// this.sfx_ = new Sound(ac);

		this.flyCam_ = new FlyCamController(rc.gl.canvas, [0, 2, 5]);

		this.setMode(GameMode.Loading);
		this.createScene();
	}



	makeSkybox() {
		const sb = this.scene_.makeEntity();
		this.skyBox_ = new world.Skybox(this.rc, this.scene_.transformMgr, this.scene_.meshMgr, this.assets_.tex.envCubeSpace);
		this.skyBox_.setEntity(sb.entity);
	}

	createScene() {
		const scene = this.scene_;
		const pbrm = scene.pbrModelMgr;
		const ltm = scene.lightMgr;
		const rc = this.rc;
		const ac = this.ac;

		const progress = (ratio: number) => {
			dom.$1(".progress").style.width = (ratio * 100) + "%";
		};

		loadAllAssets(rc, ac, scene.meshMgr, progress).then(assets => {
			const mat = asset.makeMaterial("floor");
			mat.roughness = 0.3;
			console.info("ASSETS", assets);
			this.assets_ = assets;

			scene.makeEntity({
				transform: {
					position: [1.2, 0, 1.2]
				},
				mesh: {
					name: "cube",
					meshData: meshdata.gen.generate(new meshdata.gen.Box({ width: 2, depth: 2, height: 2, inward: false }))
				},
				pbrModel: {
					materials: [assets.mat.chipmetal]
				}
			});
			scene.makeEntity({

			this.makeSkybox();

				transform: {
					position: [-1.2, 0, -1.2]
				},
				mesh: {
					name: "sphere",
					meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: 1, rows: 20, segs: 30 }))
				},
				pbrModel: {
					materials: [assets.mat.medmetal]
				}
			});
			scene.makeEntity({
				transform: {
					position: [0, -1, 0],
					// rotation: quat.fromEuler(0, 0, Math.PI / 2)
				},
				mesh: {
					name: "floor2",
					meshData: meshdata.gen.generate(new meshdata.gen.Plane({ width: 8, depth: 8, rows: 2, segs: 2 }))
				},
				pbrModel: {
					materials: [assets.mat.medmetal]
				}
			});

			// const l1 = scene.makeEntity({
			// 	transform: { position: [2, 3, 2] },
			// 	light: {
			// 		name: "point",
			// 		type: asset.LightType.Point,
			// 		intensity: 2,
			// 		range: 8,
			// 		colour: [0, 1, 1],
			// 	}
			// });
			// const l2 = scene.makeEntity({
			// 	transform: { position: [-2, 3, 2] },
			// 	light: {
			// 		name: "point",
			// 		type: asset.LightType.Point,
			// 		intensity: 2,
			// 		range: 8,
			// 		colour: [1, 0, 1],
			// 	}
			// });
			// const l3 = scene.makeEntity({
			// 	transform: { position: [2, 3, -2] },
			// 	light: {
			// 		name: "point",
			// 		type: asset.LightType.Point,
			// 		intensity: 2,
			// 		range: 8,
			// 		colour: [1, 1, 0],
			// 	}
			// });
			const l4 = scene.makeEntity({
				transform: { position: [3.5, 2.5, 3.5] },
				light: {
					name: "spot",
					type: asset.LightType.Spot,
					intensity: 2.5,
					range: 12,
					colour: [1, 1, 1],
					cutoff: math.deg2rad(35),
					shadowType: asset.ShadowType.Soft,
					shadowQuality: asset.ShadowQuality.Auto,
					shadowStrength: 1,
					shadowBias: 0.002
				}
			});

			this.spotLight_ = l4.light!;
			ltm.setDirection(this.spotLight_, [-1, -1, -1]);
			scene.pbrModelMgr.setShadowCaster(this.spotLight_);

			this.setMode(GameMode.Title);
		});
	}


	resume() {
		if (this.mode_ >= GameMode.Title) {
			// this.sfx_.startMusic();
		}
	}


	suspend() {
		if (this.mode_ >= GameMode.Title) {
			// this.sfx_.stopMusic();
		}
	}


	setMode(newMode: GameMode) {
		if (newMode != GameMode.Loading) {
			dom.hide(".loading");
		}
		dom.hide(".titles");
		dom.show("#stage");

		this.mode_ = newMode;
	}


	renderFrame(timeStep: number) {
		if (this.mode_ < GameMode.Title) {
			return;
		}

		// -- shadow pass
		let spotShadow: world.ShadowView | null = null;
		const shadowCaster = this.scene_.pbrModelMgr.shadowCaster();

		if (shadowCaster && render.canUseShadowMaps(this.rc)) {
			let rpdShadow = render.makeRenderPassDescriptor();
			rpdShadow.clearMask = render.ClearMask.Depth;

			spotShadow = this.scene_.lightMgr.shadowViewForLight(this.rc, shadowCaster, .1);
			if (spotShadow) {
				render.runRenderPass(this.rc, this.scene_.meshMgr, rpdShadow, spotShadow.shadowFBO, (renderPass) => {
					this.scene_.pbrModelMgr.drawShadows(this.scene_.pbrModelMgr.all(), renderPass, spotShadow!.lightProjection);
				});
			}
		}

		// -- main forward pass
		let rpdMain = render.makeRenderPassDescriptor();
		vec4.set(rpdMain.clearColour, 0, 0, 0, 1);
		rpdMain.clearMask = render.ClearMask.ColourDepth;

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			let camera: world.ProjectionSetup = {
				projectionMatrix: mat4.perspective([], math.deg2rad(50), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 0.1, 100),
				viewMatrix: this.flyCam_.cam.viewMatrix // this.playerController_.viewMatrix
			};

			this.scene_.lightMgr.prepareLightsForRender(this.scene_.lightMgr.all(), camera, renderPass.viewport()!);

			renderPass.setDepthTest(render.DepthTest.Less);
			renderPass.setFaceCulling(render.FaceCulling.Back);

			this.scene_.pbrModelMgr.draw(this.scene_.pbrModelMgr.all(), renderPass, camera, spotShadow, world.PBRLightingQuality.CookTorrance, this.assets_.tex.reflectCubeSpace);

			this.skyBox_.draw(renderPass, camera);
		});

	}


	simulationStep(timeStep: number) {
		const txm = this.scene_.transformMgr;
		this.flyCam_.step(timeStep);

		if (this.skyBox_) {
			this.skyBox_.setCenter(this.flyCam_.cam.pos);
		}
	}
}


dom.on(window, "load", () => {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	const mainCtl = new MainScene(rctx, actx);
	sd.defaultRunLoop.sceneController = mainCtl;
	sd.defaultRunLoop.start();
});
