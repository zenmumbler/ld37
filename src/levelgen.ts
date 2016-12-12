// Callisto, a Ludum Dare 37 Entry
// (c) 2016 by Arthur Langereis (@zenmumbler)

type PillarYGen = (xz: sd.Float2, tileXZ: sd.Float2, baseY: number) => number;


class LevelGen {
	constructor(private rc: render.RenderContext, private ac: audio.AudioContext, private assets: Assets, private scene: world.Scene) {}


	makeGlower(position: sd.Float3, radius: number) {
		this.scene.makeEntity({
			transform: {
				position: position
			},
			mesh: {
				name: "sphere",
				meshData: meshdata.gen.generate(new meshdata.gen.Sphere({ radius: radius, rows: 20, segs: 30 }))
			},
			pbrModel: {
				materials: [this.assets.mat.whitemarble]
			},
			light: {
				name: "spherelight1",
				type: asset.LightType.Point,
				intensity: 8,
				range: 3 * radius,
				colour: [1, 0.96, 0.94]
			}
		});
	}


	generatePillarBlock(origin: sd.Float3, pillarDim: number, pillarHeight: number, width: number, depth: number, uvRange: sd.Float2, yGen: PillarYGen) {
		const tiles: meshdata.gen.TransformedMeshGen[] = [];
		const halfWidth = width * pillarDim / 2;
		const halfDepth = depth * pillarDim / 2;
		const oX = origin[0] - halfWidth;
		const oY = origin[1];
		const oZ = origin[2] - halfDepth;

		let pZ = oZ;
		for (let tileZ = 0; tileZ < depth; ++tileZ) {
			let pX = oX;
			for (let tileX = 0; tileX < width; ++tileX) {
				const pY = yGen([pX, pZ], [tileX, tileZ], oY);
				tiles.push({
					translation: [pX, pY, pZ],
					generator: new meshdata.gen.Box({
						width: pillarDim, depth: pillarDim, height: pillarHeight,
						inward: false,
						uvRange: uvRange, uvOffset: vec2.multiply([], uvRange, [tileX, tileZ])
					})
				});
				pX += pillarDim;
			}
			pZ += pillarDim;
		}

		return meshdata.gen.generate(tiles, meshdata.AttrList.Pos3Norm3UV2());
	}


	makeInnerWalls(scene: world.Scene, assets: Assets) {
		const walls: meshdata.gen.TransformedMeshGen[] = [];
		const hwalls: number[][] = [[-10, -10.5], [5, -10.5], [-10, 10], [5, 10]];
		const vwalls: number[][] = [[-10.5, -10], [10, -10], [-10.5, 5], [10, 5]];
		const cwalls: number[][] = [[-.25, -10.5], [-10.5, -0.25], [-.25, 10], [10, -.25]];
		for (let cwx = 0; cwx < 4; ++cwx) {
			walls.push({
				translation: [hwalls[cwx][0] + 2.25, 7.5, hwalls[cwx][1]],
				generator: new meshdata.gen.Box({ width: 5, depth: 0.5, height: 15, inward: false, uvRange: [5, 15] })
			});
			walls.push({
				translation: [vwalls[cwx][0], 7.5, vwalls[cwx][1] + 2.25],
				generator: new meshdata.gen.Box({ width: 0.5, depth: 5, height: 15, inward: false, uvRange: [5, 15] })
			});
			if ((cwx & 1) == 0) {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new meshdata.gen.Box({ width: 10, depth: 0.5, height: 12, inward: false, uvRange: [11, 12], uvOffset: [-1, 0] })
				});
			}
			else {
				walls.push({
					translation: [cwalls[cwx][0], 9, cwalls[cwx][1]],
					generator: new meshdata.gen.Box({ width: 0.5, depth: 10, height: 12, inward: false, uvRange: [11, 12], uvOffset: [-1, 0] })
				});
			}
		}
		const innerWalls = scene.makeEntity({
			mesh: {
				name: "innerwalls",
				meshData: meshdata.gen.generate(walls)
			},
			pbrModel: {
				materials: [assets.mat.chipmetal]
			}
		});
	}


	generate() {
		const scene = this.scene;
		const assets = this.assets;
		const pbrm = scene.pbrModelMgr;
		const ltm = scene.lightMgr;
		const rc = this.rc;
		const ac = this.ac;


		// -- floor and ceiling of main room
		const floor = scene.makeEntity({
			mesh: {
				name: "floor",
				meshData: this.generatePillarBlock([0, 0, 0], .5, .5, 40, 40, [0.125, 0.125], (pxz, txz, y) => y - 0.025 + (Math.random() * 0.05))
			},
			pbrModel: { materials: [assets.mat.bronzepatina] }
		});
		const ceiling = scene.makeEntity({
			mesh: {
				name: "ceil",
				meshData: this.generatePillarBlock([0, 10, 0], .5, 5, 40, 40, [.5, 3], (pxz, txz, y) => y - 1.5 + (Math.random() * 3))
			},
			pbrModel: { materials: [assets.mat.medmetal] }
		});


		// -- pillar room (back)
		const floorPillars = scene.makeEntity({
			mesh: {
				name: "floor-pillars",
				meshData: this.generatePillarBlock([0, 0, -12.5], .5, 2, 20, 10, [0.125, 0.125],
					(pxz, txz, y) => {
						let dist = vec2.len(vec2.sub([], pxz, [0, -10]));
						dist = Math.max(0, dist - 4);
						return y - 0.8 + dist - 0.025 + (Math.random() * 0.05);
					}
				)
			},
			pbrModel: { materials: [assets.mat.bronzepatina] }
		});
		const spotPillars = scene.makeEntity({
			transform: { position: [0, 4, -8] },
			light: {
				name: "spot-pillars",
				colour: [1, .96, .94],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotPillars.light!, [0, -.707, -.707]);
		ltm.setEnabled(spotPillars.light!, false);

		// -- puzzle room left
		const floorPuzzleLeft = scene.makeEntity({
			mesh: {
				name: "floor-left",
				meshData: this.generatePillarBlock([-12.5, 0, 0], .5, 2, 10, 20, [0.125, 0.125],
					(pxz, txz, y) => {
						let dist = vec2.len(vec2.sub([], pxz, [-10, 0]));
						dist = Math.max(0, dist - 4);
						return y - 0.8 + dist - 0.025 + (Math.random() * 0.05);
					}
				)
			},
			pbrModel: { materials: [assets.mat.bronzepatina] }
		});
		const spotLeft = scene.makeEntity({
			transform: { position: [-8, 4, 0] },
			light: {
				name: "spot-left",
				colour: [1, 1, 1],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotLeft.light!, [-.707, -.707, 0]);
		ltm.setEnabled(spotLeft.light!, false);


		// -- puzzle room right
		const floorPuzzleRight = scene.makeEntity({
			mesh: {
				name: "floor-right",
				meshData: this.generatePillarBlock([12.5, 0, 0], .5, 2, 10, 20, [0.125, 0.125],
					(pxz, txz, y) => {
						let dist = vec2.len(vec2.sub([], pxz, [10, 0]));
						dist = Math.max(0, dist - 4);
						return y - 0.8 + dist - 0.025 + (Math.random() * 0.05);
					}
				)
			},
			pbrModel: { materials: [assets.mat.bronzepatina] }
		});
		const spotRight = scene.makeEntity({
			transform: { position: [8, 4, 0] },
			light: {
				name: "spot-right",
				colour: [1, 1, 1],
				type: asset.LightType.Spot,
				intensity: 2.5,
				range: 10,
				cutoff: math.deg2rad(35)
			}
		});
		ltm.setDirection(spotRight.light!, [.707, -.707, 0]);
		ltm.setEnabled(spotRight.light!, false);

		// --
		this.makeInnerWalls(scene, assets);

		this.makeGlower([0, 1, 0], 1);

		for (let qq = 0; qq < 8; ++qq) {
			this.makeGlower([((qq * 16) % 20) - 10, 6.5, ((qq * 34) % 20) - 10], .6);
		}

		return Promise.resolve();
	}
}