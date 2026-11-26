export const SARS_COV_2_VIRION_ASSET = {
  path: "/models/biology/sars-cov-2-virion-nih3d.glb",
  sourceTitle: "SARS CoV-2 Virion (NIAID)",
  sourceUrl: "https://3d.nih.gov/entries/3DPX-013323/2.01",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalFileId: "581060",
  originalSha256:
    "f1bff39b83418a83f5fc48bfbbcb693cd10b4d8aab3fe8e9e93af4550f9cef7b",
  processedSha256:
    "effb749e69aceb8e53918e3e9d84a27f31b0cfe6100e742188d1405ecab7cc03",
  processedWith:
    "gltf-transform weld, then simplify --ratio 0.35 --error 0.002",
} as const;

export const TERRA_SATELLITE_ASSET = {
  path: "/models/biology/terra-nasa.glb",
  sourceTitle: "Terra",
  sourceUrl: "https://science.nasa.gov/3d-resources/terra/",
  license: "NASA media usage guidelines",
  licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  originalSha256:
    "8794857595f7a7d416184fe926ecb50e11bf267dbe471d1cf2728a85e8d017fa",
  processedSha256:
    "35c73fda2c751995aefbd3dfb303524cdea3667128983009227e3874b164d04c",
  processedWith:
    "Removed missing external TGA texture references; retained material colors.",
} as const;

export const BLUE_MARBLE_EARTH_TEXTURE_ASSET = {
  path: "/textures/biology/blue-marble-january-2048.jpg",
  sourceTitle:
    "Blue Marble: Next Generation with Topography and Bathymetry, January",
  sourceUrl:
    "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/",
  sourceImageUrl:
    "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg",
  license: "NASA media usage guidelines",
  licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  originalSha256:
    "1684c4f8f51970dcb4a7451302bf3be17bed657aed9fece6f80d7b191e8afa3d",
  processedSha256:
    "b5ff8775b4f7c69982dea597c9d23433ac02cb5a3873171f7d9ab576ce4ec87c",
  processedWith: "Resized to 2048px wide JPEG with sips for web delivery.",
} as const;

export const HRA_KNEE_JOINT_ASSET = {
  path: "/models/biology/hra-knee-joint.glb",
  sourceTitle:
    "Human Reference Atlas 3D Reference Organ: Knee, Male, Left v1.2",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/knee-male-left/v1.2/assets/3d-vh-m-knee-l.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "2f15b825da044aafef760ab62aa2e9111f63d674efaa4c3d96ddb04f9b1ef6aa",
  processedSha256:
    "581649c95c08a127d6403ac66be386d695299860fff74db17578daf56c2dcaed",
  processedWith:
    "gltf-transform optimize --compress false --simplify-ratio 0.5 --simplify-error 0.01",
} as const;

export const HRA_LIVER_ASSET = {
  path: "/models/biology/hra-liver.glb",
  sourceTitle: "Human Reference Atlas 3D Reference Organ: Liver, Male v1.2",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/liver-male/v1.2/assets/3d-vh-m-liver.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "8e4c38293cfdb6b4f47ef2930c7f4af9e37b9144d1cf26d07c8f12c5045eb404",
  processedSha256:
    "0c0b9772774af5292338cc778617da94fb308886d359e3d3e37b3ca7febd3741",
  processedWith:
    "gltf-transform optimize --compress false --simplify-ratio 0.12 --simplify-error 0.03",
} as const;

export const HRA_PANCREAS_ASSET = {
  path: "/models/biology/hra-pancreas.glb",
  sourceTitle: "Human Reference Atlas 3D Reference Organ: Pancreas, Male v1.3",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/pancreas-male/v1.3/assets/3d-vh-m-pancreas.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "a89d7acbc9448ca1e6c09f7f6d6a18b2bd8a2e94cd4a0b51709915a8b7bea84e",
  processedSha256:
    "f41a78c078b39118e56565e5aa456b2ac9a8dc55161e72e2d2dc2a629e15425e",
  processedWith: "gltf-transform simplify + optimize + quantize",
} as const;

export const HRA_PELVIS_ASSET = {
  path: "/models/biology/hra-pelvis.glb",
  sourceTitle: "Human Reference Atlas 3D Reference Organ: Pelvis, Male v1.3",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/pelvis-male/v1.3/assets/3d-vh-m-pelvis.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "5bfd2c34b62a7224796d50002bcdf9ded60ea11485a118351dfd1f19c6853e77",
  processedSha256:
    "8591dadefc23e13158dbc3cff0138ea945046ca4210764d529fc0dd00ba7dcfe",
  processedWith:
    "gltf-transform optimize --compress false --simplify-ratio 0.25 --simplify-error 0.02",
} as const;

export const HRA_PLACENTA_ASSET = {
  path: "/models/biology/hra-placenta.glb",
  sourceTitle:
    "Human Reference Atlas 3D Reference Organ: Placenta Full Term, Female v1.1",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/placenta-full-term-female/v1.1/assets/3d-vh-f-placenta-full-term.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "32381ebb2b2369e8e83c2b1e5f94cb1cafccf1e1e23439f80bada482ab9e57ef",
  processedSha256:
    "f35dc42ce78db30c77d54dbad0fdcf7c2a85d73fb7ea419badf8d05d4ef7cda6",
  processedWith:
    "gltf-transform optimize --compress false --simplify-ratio 0.15 --simplify-error 0.03",
} as const;
