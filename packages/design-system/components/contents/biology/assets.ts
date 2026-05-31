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
