
import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import conveyorData from './conveyor-members.json'



const scene = new THREE.Scene()
scene.background = new THREE.Color(0xffffff)
const viewport = document.querySelector('#viewport')
const showSensorNumbers = document.querySelector('#show-sensor-numbers')

const positions = []
const colors = []
const statusColors = {
  '#00FF00': new THREE.Color(0x16a36a),
  '#FF0000': new THREE.Color(0xe74c3c),
}

for (const member of conveyorData.members) {
  if(member.status === '#FF0000') continue
  const color = statusColors[member.status] ?? new THREE.Color(0x3498db)
  positions.push(
    member.x1, member.y1, member.z1,
    member.x2, member.y2, member.z2,
  )
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
}

const sensorPositions = conveyorData.members
  .filter(member => member.status === '#FF0000')
  .flatMap(member => [member.x1, member.y1, member.z1])

const structureGeometry = new THREE.BufferGeometry()
structureGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
structureGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
const structure = new THREE.LineSegments(
  structureGeometry,
  new THREE.LineBasicMaterial({ vertexColors: true }),
)
scene.add(structure)

const sensorGeometry = new THREE.BufferGeometry()
sensorGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(sensorPositions, 3),
)

const canvas = document.createElement('canvas')
canvas.width = 64
canvas.height = 64

const context = canvas.getContext('2d')
context.beginPath()
context.arc(32, 32, 30, 0, Math.PI * 2)
context.fillStyle = 'white'
context.fill()

const circleTexture = new THREE.CanvasTexture(canvas)

const sensorMaterial = new THREE.PointsMaterial({
  color: 0xe74c3c,
  size: 8,
  sizeAttenuation: false,
  map: circleTexture,
  transparent: true,
  alphaTest: 0.5,
})

const sensors = new THREE.Points(sensorGeometry, sensorMaterial)
scene.add(sensors)

const sensorInfo = document.createElement('div')
sensorInfo.className = 'sensor-info'
sensorInfo.hidden = true
viewport.appendChild(sensorInfo)

const selectedSensorPosition = new THREE.Vector3()
let hasSelectedSensor = false

const structureBounds = new THREE.Box3().setFromBufferAttribute(
  structureGeometry.getAttribute('position'),
)
const structureCenter = structureBounds.getCenter(new THREE.Vector3())
const structureSize = structureBounds.getSize(new THREE.Vector3())
const structureSpan = Math.max(structureSize.x, structureSize.y, structureSize.z)

const camera = new THREE.PerspectiveCamera(
  50,
  viewport.clientWidth / viewport.clientHeight,
  0.1,
  1000
)
  
camera.position.copy(structureCenter).add(new THREE.Vector3(
  structureSpan * 0.9,
  structureSpan * 0.7,
  structureSpan * 1.1,
))

// 3. Create Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true
})

renderer.setSize(viewport.clientWidth, viewport.clientHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

viewport.appendChild(renderer.domElement)

const sensorLabels = sensorPositions.reduce((labels, _, index) => {
  if (index % 3 === 0) {
    const label = document.createElement('span')
    label.className = 'sensor-label'
    label.textContent = String(index / 3 + 1)
    label.hidden = true
    viewport.appendChild(label)
    labels.push(label)
  }
  return labels
}, [])


const grid = new THREE.GridHelper(structureSpan * 1.4, 28, 0xe1e5e9, 0xf0f2f4)
grid.position.y = structureBounds.min.y
scene.add(grid)

const axes = new THREE.AxesHelper(structureSpan * 0.04)
axes.position.set(-80.163, 0.152, -3.2)
scene.add(axes)

const groundSupportNodes = [
  [-24.79806, -23.67495, -6.44],
  [-24.79806, -23.67495, 6.44],
  [32.59171, -22.56896, -5.898],
  [32.59171, -22.56896, 5.898],
  [38.47971, -22.56896, -5.898],
  [38.47971, -22.56896, 5.898],
]
const supportMarkerGeometry = new THREE.SphereGeometry(structureSpan * 0.005, 12, 8)
const supportMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b })

for (const [x, y, z] of groundSupportNodes) {
  const marker = new THREE.Mesh(supportMarkerGeometry, supportMarkerMaterial)
  marker.position.set(x, y, z)
  scene.add(marker)
}


const controls = new OrbitControls(camera, renderer.domElement)

controls.enableDamping = true
controls.target.copy(structureCenter)
controls.maxDistance = structureSpan * 5




const raycaster = new THREE.Raycaster()
raycaster.params.Points.threshold = 1.5
raycaster.params.Line.threshold = 1

const pointer = new THREE.Vector2()
const projectedStart = new THREE.Vector3()
const projectedEnd = new THREE.Vector3()

function countStructureSegmentsUnderCard(left, top, width, height, viewWidth, viewHeight) {
  const positionAttribute = structureGeometry.getAttribute('position')
  let overlaps = 0

  for (let i = 0; i < positionAttribute.count; i += 2) {
    projectedStart.fromBufferAttribute(positionAttribute, i).project(camera)
    projectedEnd.fromBufferAttribute(positionAttribute, i + 1).project(camera)

    const x1 = (projectedStart.x + 1) * viewWidth / 2
    const y1 = (1 - projectedStart.y) * viewHeight / 2
    const x2 = (projectedEnd.x + 1) * viewWidth / 2
    const y2 = (1 - projectedEnd.y) * viewHeight / 2

    if (
      Math.max(x1, x2) >= left && Math.min(x1, x2) <= left + width &&
      Math.max(y1, y2) >= top && Math.min(y1, y2) <= top + height
    ) {
      overlaps++
    }
  }

  return overlaps
}

function placeSensorInfo(sensorX, sensorY, viewWidth, viewHeight) {
  const cardWidth = sensorInfo.offsetWidth
  const cardHeight = sensorInfo.offsetHeight
  const gap = 14
  const candidates = [
    { left: sensorX + gap, top: sensorY - cardHeight / 2 },
    { left: sensorX - cardWidth - gap, top: sensorY - cardHeight / 2 },
    { left: sensorX - cardWidth / 2, top: sensorY - cardHeight - gap },
    { left: sensorX - cardWidth / 2, top: sensorY + gap },
  ].filter(({ left, top }) =>
    left >= 0 && top >= 0 && left + cardWidth <= viewWidth && top + cardHeight <= viewHeight,
  )

  const availableCandidates = candidates.length ? candidates : [{
    left: Math.max(0, Math.min(sensorX + gap, viewWidth - cardWidth)),
    top: Math.max(0, Math.min(sensorY - cardHeight / 2, viewHeight - cardHeight)),
  }]

  let best = availableCandidates[0]
  let fewestOverlaps = Infinity

  for (const candidate of availableCandidates) {
    const overlaps = countStructureSegmentsUnderCard(
      candidate.left, candidate.top, cardWidth, cardHeight, viewWidth, viewHeight,
    )
    if (overlaps < fewestOverlaps) {
      best = candidate
      fewestOverlaps = overlaps
    }
    if (overlaps === 0) break
  }

  sensorInfo.style.left = `${best.left}px`
  sensorInfo.style.top = `${best.top}px`
}

renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect()
  // const viewportRect = viewport.getBoundingClientRect()

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera)

  const hits = raycaster.intersectObject(sensors)

  if (hits.length === 0) {
    const memberHits = raycaster.intersectObject(structure)

    if (memberHits.length > 0) {
      hasSelectedSensor = false
      const point = memberHits[0].point
      const memberDetails = document.createElement('div')
      memberDetails.className = 'sensor-details'
      memberDetails.textContent =
        `Structure member\n` +
        `X: ${point.x.toFixed(3)}\n` +
        `Y: ${point.y.toFixed(3)}\n` +
        `Z: ${point.z.toFixed(3)}`
      sensorInfo.replaceChildren(memberDetails)

      const screenPoint = point.clone().project(camera)
      placeSensorInfo(
        (screenPoint.x + 1) * rect.width / 2,
        (1 - screenPoint.y) * rect.height / 2,
        rect.width,
        rect.height,
      )
      sensorInfo.hidden = false
      return
    }

    sensorInfo.hidden = true
    hasSelectedSensor = false
    return
  }

  const sensorIndex = hits[0].index
  const positionIndex = sensorIndex * 3
  selectedSensorPosition.set(
    sensorPositions[positionIndex],
    sensorPositions[positionIndex + 1],
    sensorPositions[positionIndex + 2],
  )
  hasSelectedSensor = true

  const sensorDetails = document.createElement('div')
  sensorDetails.className = 'sensor-details'
  sensorDetails.textContent =
    `Sensor ${sensorIndex + 1}\n` +
    `X: ${sensorPositions[positionIndex]}\n` +
    `Y: ${sensorPositions[positionIndex + 1]}\n` +
    `Z: ${sensorPositions[positionIndex + 2]}`

  const liveInformationOption = document.createElement('label')
  liveInformationOption.className = 'live-information-option'

  const liveInformationCheckbox = document.createElement('input')
  liveInformationCheckbox.type = 'checkbox'

  const liveInformationText = document.createElement('span')
  liveInformationText.textContent = 'Do you want live info?'

  liveInformationOption.append(liveInformationCheckbox, liveInformationText)
  sensorInfo.replaceChildren(sensorDetails, liveInformationOption)

  sensorInfo.hidden = false
})




function animate() {
  requestAnimationFrame(animate)

  controls.update()

  const rect = renderer.domElement.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  sensorLabels.forEach((label, index) => {
    const position = new THREE.Vector3(
      sensorPositions[index * 3],
      sensorPositions[index * 3 + 1],
      sensorPositions[index * 3 + 2],
    ).project(camera)
    const isVisible = position.z >= -1 && position.z <= 1 &&
      Math.abs(position.x) <= 1 && Math.abs(position.y) <= 1

    label.hidden = !showSensorNumbers.checked || !isVisible
    if (!label.hidden) {
      label.style.left = `${rect.left - viewportRect.left + (position.x + 1) * rect.width / 2}px`
      label.style.top = `${rect.top - viewportRect.top + (1 - position.y) * rect.height / 2}px`
    }
  })

  if (hasSelectedSensor) {
    const screenPosition = selectedSensorPosition.clone().project(camera)
    const rect = renderer.domElement.getBoundingClientRect()
    const isVisible =
      screenPosition.z >= -1 &&
      screenPosition.z <= 1 &&
      Math.abs(screenPosition.x) <= 1 &&
      Math.abs(screenPosition.y) <= 1

    sensorInfo.hidden = !isVisible

    if (isVisible) {
      const sensorX = (screenPosition.x + 1) * rect.width / 2
      const sensorY = (1 - screenPosition.y) * rect.height / 2
      placeSensorInfo(sensorX, sensorY, rect.width, rect.height)
    }
  }

  renderer.render(scene, camera)
}

animate()

const resizeObserver = new ResizeObserver(() => {
  const width = viewport.clientWidth
  const height = viewport.clientHeight

  if (!width || !height) return

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
})

resizeObserver.observe(viewport)


