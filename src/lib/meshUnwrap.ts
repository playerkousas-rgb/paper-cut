import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'

export type LoadedMesh = {
  geometry: THREE.BufferGeometry
  bbox: THREE.Box3
}

function toNonIndexed(geom: THREE.BufferGeometry) {
  const g = geom.index ? geom.toNonIndexed() : geom
  // Ensure we have normals
  if (!g.attributes.normal) g.computeVertexNormals()
  return g
}

export async function loadMeshFromFile(file: File): Promise<LoadedMesh> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buf = await file.arrayBuffer()

  if (ext === 'glb' || ext === 'gltf') {
    const loader = new GLTFLoader()
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(
        buf as any,
        '',
        (res) => resolve(res),
        (err) => reject(err),
      )
    })

    // Pick first mesh
    let found: THREE.Mesh | null = null
    gltf.scene.traverse((o: any) => {
      if (found) return
      if (o && o.isMesh && o.geometry) found = o
    })

    if (!found) throw new Error('No mesh found in GLB')
    const g = toNonIndexed((found as THREE.Mesh).geometry.clone())
    const bbox = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as any)
    return { geometry: g, bbox }
  }

  // For OBJ/STL we would normally parse with loaders, but that increases bundle.
  // This MVP focuses on GLB which is the most common web 3D interchange.
  throw new Error('Only GLB/GLTF is supported for auto-unfold in this version')
}

export type UnwrapOptions = {
  maxFacesPerPiece: number
  angleThresholdDeg: number
}

export type UnwrapPiece = {
  id: number
  uv2: Array<[number, number]> // per vertex in triangle soup (3*faces)
  triangles: Array<[number, number, number]> // indices into uv2 list
  faceCount: number
}

function angleBetween(n1: THREE.Vector3, n2: THREE.Vector3) {
  const d = THREE.MathUtils.clamp(n1.dot(n2), -1, 1)
  return Math.acos(d)
}

export function unwrapByNormalClustering(
  geomIn: THREE.BufferGeometry,
  opts: UnwrapOptions,
): { pieces: UnwrapPiece[]; totalFaces: number } {
  const geom = toNonIndexed(geomIn)
  const pos = geom.getAttribute('position') as THREE.BufferAttribute

  const faceCount = pos.count / 3
  const normals: THREE.Vector3[] = []
  normals.length = faceCount

  // Compute per-face normals
  for (let f = 0; f < faceCount; f++) {
    const i = f * 3
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1))
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
    normals[f] = n
  }

  const angleThr = THREE.MathUtils.degToRad(opts.angleThresholdDeg)
  const maxFaces = Math.max(10, Math.min(20000, opts.maxFacesPerPiece))

  const unassigned = new Set<number>()
  for (let f = 0; f < faceCount; f++) unassigned.add(f)

  const pieces: UnwrapPiece[] = []
  let pid = 1

  while (unassigned.size > 0) {
    const seed = unassigned.values().next().value as number
    unassigned.delete(seed)

    const bucket: number[] = [seed]
    const mean = normals[seed].clone()

    // Greedy clustering by normal similarity
    // (Not perfect seams like Pepakura, but produces real 2D layouts derived from the mesh.)
    for (const f of Array.from(unassigned)) {
      if (bucket.length >= maxFaces) break
      const ang = angleBetween(normals[f], mean.clone().normalize())
      if (ang <= angleThr) {
        bucket.push(f)
        mean.add(normals[f])
        unassigned.delete(f)
      }
    }

    // Determine a projection plane for the piece
    const n = mean.normalize()
    // Build orthonormal basis (u,v) on the plane
    const ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const u = new THREE.Vector3().crossVectors(ref, n).normalize()
    const v = new THREE.Vector3().crossVectors(n, u).normalize()

    const uv2: Array<[number, number]> = []
    const triangles: Array<[number, number, number]> = []

    for (const f of bucket) {
      const i = f * 3
      const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
      const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1))
      const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))

      const au = a.dot(u)
      const av = a.dot(v)
      const bu = b.dot(u)
      const bv = b.dot(v)
      const cu = c.dot(u)
      const cv = c.dot(v)

      const base = uv2.length
      uv2.push([au, av], [bu, bv], [cu, cv])
      triangles.push([base, base + 1, base + 2])
    }

    pieces.push({ id: pid++, uv2, triangles, faceCount: bucket.length })
  }

  return { pieces, totalFaces: faceCount }
}
