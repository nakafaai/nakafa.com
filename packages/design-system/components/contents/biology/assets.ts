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

export const HRA_LUNGS_ASSET = {
  path: "/models/biology/hra-lungs.glb",
  sourceTitle: "Human Reference Atlas 3D Reference Organ: Lung, Male v1.4",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "bba95516fa993ac45c3b1c53f32b58d97232ffd78ae56397e5a2589c6ce4903d",
  processedSha256:
    "388f438ea437127314987b3c2be47883c6fe4040792d8b2cdddfa0ec206ddf23",
  processedWith:
    "Stripped COLOR_0 and hard NORMAL, then gltf-transform dedup, flatten, weld, simplify (ratio 0.06, error 0.02), prune",
} as const;

export const HRA_BODY_ASSET = {
  path: "/models/biology/hra-body.glb",
  sourceTitle: "Human Reference Atlas 3D Reference Organ: Skin, Male v1.3",
  sourceUrl:
    "https://cdn.humanatlas.io/digital-objects/ref-organ/skin-male/v1.3/assets/3d-vh-m-skin.glb",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "8d0963adbce98bf3606ec59467b1fe4ad69653df17dac515d4fb69026e62f064",
  processedSha256:
    "38df2c3e3df7bb3adc0e433b785da71974b2e7789e434baa4eee41fb93dae9d8",
  processedWith:
    "Stripped COLOR_0, then gltf-transform dedup, flatten, weld, simplify (ratio 0.14, error 0.015), prune",
} as const;

export const CC0_BARRAMUNDI_FISH_ASSET = {
  path: "/models/biology/cc0-barramundi-fish.glb",
  sourceTitle: "Barramundi Fish (Khronos glTF-Sample-Assets)",
  sourceUrl:
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BarramundiFish/glTF-Binary/BarramundiFish.glb",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalSha256:
    "ecc3bafb6b00f2c8b810863c388e3768a7b7ea0d0335e8cb8c574c266e571f4a",
  processedSha256:
    "3806accd67bb7bddde96852a02ad301f7ea22ba0dcba4ba8472474c305d8460a",
  processedWith:
    "gltf-transform optimize --compress false --texture-size 512 --texture-compress webp --simplify-ratio 0.65 --simplify-error 0.005",
} as const;

export const MIT_BIRD_FLIGHT_ASSET = {
  path: "/models/biology/mit-bird-flight.glb",
  sourceTitle: "Stork Flight Morph-Target Model (Three.js Examples)",
  sourceUrl:
    "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Stork.glb",
  license: "MIT",
  licenseUrl: "https://opensource.org/licenses/MIT",
  originalSha256:
    "60ca9355daaddeab33d93d6856d99c12b7ed086f989bf1a1ba288f7e96e1559b",
  processedSha256:
    "60ca9355daaddeab33d93d6856d99c12b7ed086f989bf1a1ba288f7e96e1559b",
  processedWith: "Copied intact to preserve morph-target wing flap animation.",
} as const;

export const CC0_DEER_ASSET = {
  path: "/models/biology/cc0-deer.glb",
  sourceTitle: "Deer (Quaternius Ultimate Animals Pack)",
  sourceUrl:
    "https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/animals_pack/Deer.glb",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalSha256:
    "b6558249bfb225313c35dd1b6c91d832b2031d064039bb6b3600a624a882a174",
  processedSha256:
    "c462a71ae68a9162e68002ca5acc7aff8667a85f3df385496a33a64ad82c37cd",
  processedWith:
    "Stripped unused skins, animations, JOINTS_0, WEIGHTS_0, then gltf-transform dedup, flatten, weld, prune",
} as const;

export const CC0_FOX_ASSET = {
  path: "/models/biology/cc0-fox.glb",
  sourceTitle: "Fox (Quaternius Ultimate Animals Pack)",
  sourceUrl:
    "https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/animals_pack/Fox.glb",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalSha256:
    "1785e9ce836107276853a8a8183d7c6fa14e5befbd105d79be1fb7e38de9f446",
  processedSha256:
    "815fcc1f5023444485c96e28a6fcea680a22ca70ea51669a8a35ab53b34a7930",
  processedWith:
    "Stripped unused skins, animations, JOINTS_0, WEIGHTS_0, then gltf-transform dedup, flatten, weld, prune",
} as const;

export const CC0_MIGRATORY_LOCUST_ASSET = {
  path: "/models/biology/cc0-migratory-locust.glb",
  sourceTitle:
    "Migratory Locust, Locusta migratoria, male (ffishAsia and floraZia)",
  sourceUrl:
    "https://sketchfab.com/3d-models/cc0-migratory-locust-l-migratoria-b63750b883b446358265beca24b566bf",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalSha256:
    "864290fdf7a9ec4a9d065290b1b0d00be053b32a3b5440b7f77a8c8f0f8c1304",
  processedSha256:
    "525f4c4fd55e5467e5a7e43b663676f5a5a93ef97df6cbd562e0a62abe16bcdf",
  processedWith:
    "gltf-transform: removed the colour-chart cube, unlit to PBR, weld, simplify (33k triangles), quantize, 1024px WebP texture",
} as const;

export const CCBY_MONARCH_BUTTERFLY_ASSET = {
  path: "/models/biology/ccby-monarch-butterfly.glb",
  sourceTitle:
    "Monarch Butterfly, Virginia Tech Insect Collection VTU_ESC_000004 (Maureen Saverot)",
  sourceUrl:
    "https://sketchfab.com/3d-models/monarch-butterfly-3a5fc9a496cb402297ffdb6700d2ab60",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "20090f8868deddb72e958ae936938d74b8ee8fa33b8e50066bffc1658c94508d",
  processedSha256:
    "66010885cb30384fbcdc8327de0a6b429978f616f525d321c13f8b673130a228",
  processedWith:
    "gltf-transform: unlit to PBR, weld, simplify (27k triangles), quantize, 1024px WebP texture",
} as const;

export const CC0_HOUSEFLY_ASSET = {
  path: "/models/biology/cc0-housefly.glb",
  sourceTitle:
    "Musca domestica, house fly (Digital Archive of Natural History, DiNArDa)",
  sourceUrl:
    "https://sketchfab.com/3d-models/musca-domestica-157900941156422fbd9dcdfc38a3be19",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalSha256:
    "285900b41ce8b4eabb474cc049e7a3871932262e7f61c47f509911ba351ff6b9",
  processedSha256:
    "2b2bb524a14312290b527fc3e7a0be7359e14f962031ba51f1c8fc20f15b4149",
  processedWith:
    "gltf-transform: specular-glossiness to metal-rough, weld, simplify (12k triangles), quantize, 512px WebP texture",
} as const;

export const CCBY_PITCHER_PLANT_ASSET = {
  path: "/models/biology/ccby-pitcher-plant.glb",
  sourceTitle:
    "White-topped Pitcher plant, Sarracenia leucophylla (Libraries of Life)",
  sourceUrl:
    "https://sketchfab.com/3d-models/white-topped-pitcher-plant-639d6edef0ca4f8897fe6dd994ca5d73",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "479ed1340dd7dd7d8c1b389d0a4e95289f35535950bf8c75c4875620164b3165",
  processedSha256:
    "13d900b59bf92194e5b104014556db3d6d3a6b59cdba6463c24591f2da17b107",
  processedWith: "gltf-transform: weld, quantize, 1024px WebP texture",
} as const;

export const CCBY_MOTH_ORCHID_ASSET = {
  path: "/models/biology/ccby-moth-orchid.glb",
  sourceTitle: "Orchid, Phalaenopsis flower spike (Rigsters)",
  sourceUrl:
    "https://sketchfab.com/3d-models/orchid-ed453cd6b12f4dfa8d4f3dcf68c97cf1",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "d0d47671e6568ff1c4028372195e09d075187646f7942f454eaea2cd40ad027d",
  processedSha256:
    "585113386ce79d58ea18eba85a3cec5f77734a6879e4e477b7041ccae603380c",
  processedWith:
    "gltf-transform: base colour only, opaque, weld, simplify (22k triangles), quantize, 1024px WebP texture",
} as const;

export const CCBY_TIGER_ASSET = {
  path: "/models/biology/ccby-tiger.glb",
  sourceTitle: "tiger walk v02 (shahabahmed)",
  sourceUrl: "https://sketchfab.com/3d-models/733afd855f5d4c378f041cc89e231770",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  originalSha256:
    "4a6e97f3130d5f525e52e958cfcd687ee0ba1224eca18cff1a070b4765caec28",
  processedSha256:
    "dcfb64d3db9b752ff10608a3612aed17d66e7c5ff4c9e106e3b6e3951abaf506",
  processedWith:
    "gltf-transform: animation removed, alpha mask, weld, quantize, 1024px WebP texture",
} as const;

