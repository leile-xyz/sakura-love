"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { Music, Pause, Volume2, VolumeX } from "lucide-react"

export default function SakuraTextEffect() {
  const containerRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showVolumeControl, setShowVolumeControl] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Handle music playback
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Set initial volume
    audio.volume = volume

    // Try to play automatically (may be blocked by browser)
    const playPromise = audio.play()

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Auto-play was prevented
        setIsPlaying(false)
        console.log("Autoplay prevented:", error)
      })
    }

    // Handle visibility change to pause/play when tab is hidden/visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        audio.pause()
      } else if (isPlaying) {
        audio.play().catch((e) => console.log("Could not resume playback:", e))
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      audio.pause()
    }
  }, [isPlaying])

  // Update audio volume when volume state changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = 0
    } else {
      audio.volume = volume
    }
  }, [volume, isMuted])

  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch((e) => console.log("Could not play audio:", e))
    }

    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number.parseFloat(e.target.value))
    if (isMuted && Number.parseFloat(e.target.value) > 0) {
      setIsMuted(false)
    }
  }

  useEffect(() => {
    if (!containerRef.current || !textInputRef.current) return

    const containerEl = containerRef.current
    const textInputEl = textInputRef.current

    const fontName = "Verdana"
    // Adjust font size for mobile
    const textureFontSize = isMobile ? 60 : 90
    const fontScaleFactor = isMobile ? 0.09 : 0.075

    textInputEl.style.fontSize = textureFontSize + "px"
    textInputEl.style.font = "bold " + textureFontSize + "px " + fontName
    textInputEl.style.lineHeight = 1.1 * textureFontSize + "px"

    let scene: THREE.Scene,
      camera: THREE.PerspectiveCamera,
      renderer: THREE.WebGLRenderer,
      textCanvas: HTMLCanvasElement,
      textCtx: CanvasRenderingContext2D,
      particleGeometry: THREE.PlaneGeometry,
      dummy: THREE.Object3D,
      clock: THREE.Clock,
      cursorMesh: THREE.Mesh

    let petalInstancedMesh: THREE.InstancedMesh,
      smallPetalInstancedMesh: THREE.InstancedMesh,
      petalMaterial: THREE.MeshBasicMaterial,
      smallPetalMaterial: THREE.MeshBasicMaterial

    // Custom text with format markers
    // "/" for pause, "。" for line break (neither will be displayed)
    const rawText = "520/我爱你/。范小饭❤胡朵朵"

    // Process the raw text to create the final text with HTML and without format markers
    let finalText = ""
    let displayText = ""
    let currentLine = ""

    for (let i = 0; i < rawText.length; i++) {
      const char = rawText[i]
      if (char === "。") {
        // Add line break but don't include the period
        finalText += currentLine + "<div>"
        currentLine = ""
      } else if (char === "/") {
        // Don't include the pause marker in the text
        finalText += currentLine
        currentLine = ""
      } else {
        // Regular character
        currentLine += char
        displayText += char
      }
    }

    // Add any remaining text
    if (currentLine) {
      finalText += currentLine
    }

    // Close any open div tags
    if (finalText.includes("<div>") && !finalText.includes("</div>")) {
      finalText += "</div>"
    }

    let currentText = ""
    let currentCharIndex = 0
    const normalTypingSpeed = 200 // ms per character
    const pauseDuration = 1000 // ms for pause
    const typingSpeed = normalTypingSpeed
    let lastTypingTime = 0
    let isTypingComplete = false
    let isPaused = false
    let pauseEndTime = 0

    let string = ""

    let textureCoordinates: any[] = []
    let particles: any[] = []

    const stringBox = {
      wTexture: 0,
      wScene: 0,
      hTexture: 0,
      hScene: 0,
      caretPosScene: [0, 0],
    }

    textInputEl.innerHTML = string
    textInputEl.focus()

    init()
    createEvents()
    setCaretToEndOfInput()
    handleInput()
    refreshText()
    render()

    function init() {
      camera = new THREE.PerspectiveCamera(isMobile ? 60 : 45, window.innerWidth / window.innerHeight, 0.1, 1000)
      // Adjust camera position for mobile
      camera.position.z = isMobile ? 22 : 18

      scene = new THREE.Scene()

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(window.innerWidth, window.innerHeight)
      containerEl.appendChild(renderer.domElement)

      const orbit = new OrbitControls(camera, renderer.domElement)
      orbit.enablePan = false

      textCanvas = document.createElement("canvas")
      textCanvas.width = textCanvas.height = 0
      textCtx = textCanvas.getContext("2d")!
      particleGeometry = new THREE.PlaneGeometry(1.2, 1.2)

      // Load sakura petal texture
      const petalTexture = new THREE.TextureLoader().load("/pink-cherry-blossom-petal-texture.png")
      petalMaterial = new THREE.MeshBasicMaterial({
        alphaMap: petalTexture,
        opacity: 0.8,
        depthTest: false,
        transparent: true,
        color: 0xffb7dd,
      })

      // Load smaller sakura petal texture
      const smallPetalTexture = new THREE.TextureLoader().load("/pink-cherry-blossom-petal-texture.png")
      smallPetalMaterial = new THREE.MeshBasicMaterial({
        alphaMap: smallPetalTexture,
        opacity: 0.7,
        depthTest: false,
        transparent: true,
        color: 0xffd1e8,
      })

      dummy = new THREE.Object3D()
      clock = new THREE.Clock()

      // Create a pink cursor
      const cursorGeometry = new THREE.BoxGeometry(0.1, 4.5, 0.03)
      cursorGeometry.translate(0.2, -2.9, 0)
      const cursorMaterial = new THREE.MeshBasicMaterial({
        color: 0xff9ec3,
        transparent: true,
      })
      cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial)
      scene.add(cursorMesh)

      // Add some floating petals in the background
      addBackgroundPetals()

      // Start the typing animation
      lastTypingTime = clock.getElapsedTime() * 1000
    }

    function addBackgroundPetals() {
      const bgPetalGeometry = new THREE.PlaneGeometry(0.8, 0.8)
      const bgPetalMaterial = new THREE.MeshBasicMaterial({
        alphaMap: new THREE.TextureLoader().load("/cherry-blossom-petal-texture.png"),
        opacity: 0.3,
        depthTest: false,
        transparent: true,
        color: 0xffcce0,
      })

      // Reduce number of petals on mobile for better performance
      const petalCount = isMobile ? 15 : 30

      // Add background petals
      for (let i = 0; i < petalCount; i++) {
        const petal = new THREE.Mesh(bgPetalGeometry, bgPetalMaterial)
        // Adjust position range for mobile
        const positionRange = isMobile ? 30 : 40
        petal.position.set(
          (Math.random() - 0.5) * positionRange,
          (Math.random() - 0.5) * positionRange,
          -5 - Math.random() * 10,
        )
        petal.rotation.z = Math.random() * Math.PI * 2
        petal.scale.set(1 + Math.random() * 2, 1 + Math.random() * 2, 1)
        petal.userData = {
          rotSpeed: 0.001 + Math.random() * 0.01,
          ySpeed: 0.01 + Math.random() * 0.02,
          xSpeed: 0.005 * (Math.random() - 0.5),
        }
        scene.add(petal)
      }
    }

    function createEvents() {
      // Handle both touch and keyboard events
      const skipTypingHandler = () => {
        if (!isTypingComplete) {
          currentText = finalText
          currentCharIndex = rawText.length
          isTypingComplete = true
          textInputEl.innerHTML = currentText
          handleInput()
          refreshText()
        }
      }

      document.addEventListener("keyup", (e) => {
        // Only allow manual input when typing animation is complete
        if (isTypingComplete) {
          handleInput()
          refreshText()
        } else {
          // Skip to the end of typing animation on any key press
          skipTypingHandler()
        }
      })

      // Add touchstart event for mobile
      document.addEventListener(
        "touchstart",
        (e) => {
          // Prevent default to avoid unwanted behaviors
          if (
            !(e.target as HTMLElement).closest("button") &&
            !(e.target as HTMLElement).closest(".music-control") &&
            !(e.target as HTMLElement).closest(".volume-slider")
          ) {
            e.preventDefault()

            textInputEl.focus()
            setCaretToEndOfInput()

            // Skip to the end of typing animation on touch
            skipTypingHandler()
          }
        },
        { passive: false },
      )

      document.addEventListener("click", (e) => {
        // Don't trigger for clicks on the music control
        if (
          !(e.target as HTMLElement).closest(".music-control") &&
          !(e.target as HTMLElement).closest(".volume-slider")
        ) {
          textInputEl.focus()
          setCaretToEndOfInput()

          // Skip to the end of typing animation on click
          skipTypingHandler()
        }
      })

      textInputEl.addEventListener("focus", () => {
        clock.elapsedTime = 0
      })

      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      })
    }

    function updateTypingEffect() {
      if (isTypingComplete) return

      const currentTime = clock.getElapsedTime() * 1000

      // Handle pause
      if (isPaused) {
        if (currentTime >= pauseEndTime) {
          isPaused = false
        } else {
          return // Still paused
        }
      }

      if (currentTime - lastTypingTime > typingSpeed) {
        if (currentCharIndex < rawText.length) {
          const currentChar = rawText[currentCharIndex]

          // Check for special characters
          if (currentChar === "/") {
            // Pause the typing
            isPaused = true
            pauseEndTime = currentTime + pauseDuration
            currentCharIndex++
            lastTypingTime = currentTime
            return
          } else if (currentChar === "。") {
            // Add a line break but don't display the period
            currentText += "<div>"
            currentCharIndex++
            lastTypingTime = currentTime
            textInputEl.innerHTML = currentText
            handleInput()
            refreshText()
            return
          }

          // Handle HTML tags as a single unit
          if (finalText[currentText.length] === "<") {
            // Find the closing bracket
            const closingIndex = finalText.indexOf(">", currentText.length)
            if (closingIndex !== -1) {
              currentText += finalText.substring(currentText.length, closingIndex + 1)
            }
          } else {
            // Add the current character
            currentText += currentChar
          }

          currentCharIndex++
          textInputEl.innerHTML = currentText
          handleInput()
          refreshText()
          lastTypingTime = currentTime
        } else {
          isTypingComplete = true
        }
      }
    }

    function setCaretToEndOfInput() {
      document.execCommand("selectAll", false, null)
      document.getSelection()?.collapseToEnd()
    }

    function handleInput() {
      if (isNewLine(textInputEl.firstChild)) {
        textInputEl.firstChild.remove()
      }
      if (isNewLine(textInputEl.lastChild)) {
        if (isNewLine(textInputEl.lastChild.previousSibling)) {
          textInputEl.lastChild.remove()
        }
      }

      string = textInputEl.innerHTML
        .replaceAll("<p>", "\n")
        .replaceAll("</p>", "")
        .replaceAll("<div>", "\n")
        .replaceAll("</div>", "")
        .replaceAll("<br>", "")
        .replaceAll("<br/>", "")
        .replaceAll("&nbsp;", " ")

      stringBox.wTexture = textInputEl.clientWidth
      stringBox.wScene = stringBox.wTexture * fontScaleFactor
      stringBox.hTexture = textInputEl.clientHeight
      stringBox.hScene = stringBox.hTexture * fontScaleFactor
      stringBox.caretPosScene = getCaretCoordinates().map((c) => c * fontScaleFactor)

      function isNewLine(el: any) {
        if (el) {
          if (el.tagName) {
            if (el.tagName.toUpperCase() === "DIV" || el.tagName.toUpperCase() === "P") {
              if (el.innerHTML === "<br>" || el.innerHTML === "</br>") {
                return true
              }
            }
          }
        }
        return false
      }

      function getCaretCoordinates() {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return [0, 0]

        const range = selection.getRangeAt(0)
        const needsToWorkAroundNewlineBug =
          range.startContainer.nodeName.toLowerCase() === "div" && range.startOffset === 0
        if (needsToWorkAroundNewlineBug) {
          return [(range.startContainer as HTMLElement).offsetLeft, (range.startContainer as HTMLElement).offsetTop]
        } else {
          const rects = range.getClientRects()
          if (rects[0]) {
            return [rects[0].left, rects[0].top]
          } else {
            document.execCommand("selectAll", false, null)
            return [0, 0]
          }
        }
      }
    }

    function render() {
      requestAnimationFrame(render)
      updateTypingEffect()
      updateParticlesMatrices()
      updateCursorOpacity()

      // Animate background petals
      scene.children.forEach((child) => {
        if (child.userData && child.userData.ySpeed) {
          child.position.y -= child.userData.ySpeed
          child.position.x += child.userData.xSpeed
          child.rotation.z += child.userData.rotSpeed

          // Reset position when petal falls below view
          if (child.position.y < -15) {
            child.position.y = 15
            child.position.x = (Math.random() - 0.5) * 40
          }
        }
      })

      renderer.render(scene, camera)
    }

    function refreshText() {
      sampleCoordinates()

      particles = textureCoordinates.map((c: any, cIdx: number) => {
        const x = c.x * fontScaleFactor
        const y = c.y * fontScaleFactor
        const p =
          c.old && particles[cIdx] ? particles[cIdx] : Math.random() > 0.15 ? new Petal([x, y]) : new SmallPetal([x, y])
        if (c.toDelete) {
          p.toDelete = true
          p.scale = p.maxScale
        }
        return p
      })

      recreateInstancedMesh()
      makeTextFitScreen()
      updateCursorPosition()
    }

    function sampleCoordinates() {
      const lines = string.split(`\n`)
      const linesNumber = lines.length
      textCanvas.width = stringBox.wTexture
      textCanvas.height = stringBox.hTexture
      textCtx.font = "bold " + textureFontSize + "px " + fontName

      // Brighter color for mobile to improve visibility
      textCtx.fillStyle = isMobile ? "#ff3377" : "#ff4d8d"
      textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height)

      for (let i = 0; i < linesNumber; i++) {
        // Draw text multiple times with slight offsets for a thicker appearance
        const yPos = ((i + 0.8) * stringBox.hTexture) / linesNumber
        textCtx.fillText(lines[i], 0, yPos)

        // Add extra thickness on mobile
        if (isMobile) {
          textCtx.fillText(lines[i], 1, yPos)
          textCtx.fillText(lines[i], 0, yPos + 1)
          textCtx.fillText(lines[i], 1, yPos + 1)
        } else {
          textCtx.fillText(lines[i], 1, yPos)
          textCtx.fillText(lines[i], 0, yPos + 1)
        }
      }

      if (stringBox.wTexture > 0) {
        const imageData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height)
        const imageMask = Array.from(Array(textCanvas.height), () => new Array(textCanvas.width))
        for (let i = 0; i < textCanvas.height; i++) {
          for (let j = 0; j < textCanvas.width; j++) {
            imageMask[i][j] = imageData.data[(j + i * textCanvas.width) * 4] > 0
          }
        }

        if (textureCoordinates.length !== 0) {
          textureCoordinates = textureCoordinates.filter((c: any) => !c.toDelete)
          particles = particles.filter((c: any) => !c.toDelete)

          textureCoordinates.forEach((c: any) => {
            if (imageMask[c.y]) {
              if (imageMask[c.y][c.x]) {
                c.old = true
                if (!c.toDelete) {
                  imageMask[c.y][c.x] = false
                }
              } else {
                c.toDelete = true
              }
            } else {
              c.toDelete = true
            }
          })
        }

        for (let i = 0; i < textCanvas.height; i++) {
          for (let j = 0; j < textCanvas.width; j++) {
            if (imageMask[i][j]) {
              textureCoordinates.push({
                x: j,
                y: i,
                old: false,
                toDelete: false,
              })
            }
          }
        }
      } else {
        textureCoordinates = []
      }
    }

    function Petal([x, y]: [number, number]) {
      this.type = 0
      this.x = x + 0.2 * (Math.random() - 0.5)
      this.y = y + 0.2 * (Math.random() - 0.5)
      this.z = 0

      // Sakura colors - various shades of pink
      this.color = 340 + Math.random() * 20 // Hue between 340-360 (pink to red)

      this.isGrowing = true
      this.toDelete = false

      this.scale = 0
      // Slightly larger petals on mobile for better visibility
      this.maxScale = (isMobile ? 0.8 : 0.7) * Math.pow(Math.random(), isMobile ? 12 : 15)
      this.deltaScale = 0.03 + 0.1 * Math.random()
      this.age = Math.PI * Math.random()
      this.ageDelta = 0.01 + 0.02 * Math.random()
      this.rotationZ = 0.5 * Math.random() * Math.PI

      this.grow = function () {
        this.age += this.ageDelta
        if (this.isGrowing) {
          this.deltaScale *= 0.99
          this.scale += this.deltaScale
          if (this.scale >= this.maxScale) {
            this.isGrowing = false
          }
        } else if (this.toDelete) {
          this.deltaScale *= 1.1
          this.scale -= this.deltaScale
          if (this.scale <= 0) {
            this.scale = 0
            this.deltaScale = 0
          }
        } else {
          this.scale = this.maxScale + 0.2 * Math.sin(this.age)
          this.rotationZ += 0.001 * Math.cos(this.age)
        }
      }
    }

    function SmallPetal([x, y]: [number, number]) {
      this.type = 1
      this.x = x
      this.y = y
      this.z = 0

      this.rotationZ = 0.6 * (Math.random() - 0.5) * Math.PI

      // Lighter pink for small petals
      this.color = 330 + Math.random() * 20 // Hue between 330-350 (lighter pink)

      this.isGrowing = true
      this.toDelete = false

      this.scale = 0
      this.maxScale = 0.1 + 0.7 * Math.pow(Math.random(), 7)
      this.deltaScale = 0.03 + 0.03 * Math.random()
      this.age = Math.PI * Math.random()

      this.grow = function () {
        if (this.isGrowing) {
          this.deltaScale *= 0.99
          this.scale += this.deltaScale
          if (this.scale >= this.maxScale) {
            this.isGrowing = false
          }
        }
        if (this.toDelete) {
          this.deltaScale *= 1.1
          this.scale -= this.deltaScale
          if (this.scale <= 0) {
            this.scale = 0
          }
        }
      }
    }

    function recreateInstancedMesh() {
      scene.remove(petalInstancedMesh, smallPetalInstancedMesh)
      const totalNumberOfPetals = particles.filter((v: any) => v.type === 0).length
      const totalNumberOfSmallPetals = particles.filter((v: any) => v.type === 1).length
      petalInstancedMesh = new THREE.InstancedMesh(particleGeometry, petalMaterial, totalNumberOfPetals || 1)
      smallPetalInstancedMesh = new THREE.InstancedMesh(
        particleGeometry,
        smallPetalMaterial,
        totalNumberOfSmallPetals || 1,
      )
      scene.add(petalInstancedMesh, smallPetalInstancedMesh)

      let petalIdx = 0
      let smallPetalIdx = 0
      particles.forEach((p: any) => {
        if (p.type === 0) {
          petalInstancedMesh.setColorAt(petalIdx, new THREE.Color(`hsl(${p.color}, 90%, 80%)`))
          petalIdx++
        } else {
          smallPetalInstancedMesh.setColorAt(smallPetalIdx, new THREE.Color(`hsl(${p.color}, 85%, 85%)`))
          smallPetalIdx++
        }
      })

      smallPetalInstancedMesh.position.x = petalInstancedMesh.position.x = -0.5 * stringBox.wScene
      smallPetalInstancedMesh.position.y = petalInstancedMesh.position.y = -0.5 * stringBox.hScene
    }

    function updateParticlesMatrices() {
      let petalIdx = 0
      let smallPetalIdx = 0
      particles.forEach((p: any) => {
        p.grow()
        dummy.quaternion.copy(camera.quaternion)
        dummy.rotation.z += p.rotationZ
        dummy.scale.set(p.scale, p.scale, p.scale)
        dummy.position.set(p.x, stringBox.hScene - p.y, p.z)
        if (p.type === 1) {
          dummy.position.y += 0.5 * p.scale
        }
        dummy.updateMatrix()
        if (p.type === 0) {
          petalInstancedMesh.setMatrixAt(petalIdx, dummy.matrix)
          petalIdx++
        } else {
          smallPetalInstancedMesh.setMatrixAt(smallPetalIdx, dummy.matrix)
          smallPetalIdx++
        }
      })
      petalInstancedMesh.instanceMatrix.needsUpdate = true
      smallPetalInstancedMesh.instanceMatrix.needsUpdate = true
    }

    function makeTextFitScreen() {
      const fov = camera.fov * (Math.PI / 180)
      const fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)
      const dx = Math.abs((0.55 * stringBox.wScene) / Math.tan(0.5 * fovH))
      const dy = Math.abs((0.55 * stringBox.hScene) / Math.tan(0.5 * fov))
      const factor = Math.max(dx, dy) / camera.position.length()
      if (factor > 1) {
        camera.position.x *= factor
        camera.position.y *= factor
        camera.position.z *= factor
      }
    }

    function updateCursorPosition() {
      cursorMesh.position.x = -0.5 * stringBox.wScene + stringBox.caretPosScene[0]
      cursorMesh.position.y = 0.5 * stringBox.hScene - stringBox.caretPosScene[1]
    }

    function updateCursorOpacity() {
      const roundPulse = (t: number) => Math.sign(Math.sin(t * Math.PI)) * Math.pow(Math.sin((t % 1) * 3.14), 0.2)

      if (document.hasFocus() && document.activeElement === textInputEl) {
        cursorMesh.material.opacity = roundPulse(2 * clock.getElapsedTime())
      } else {
        cursorMesh.material.opacity = 0
      }
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", () => {})
      document.removeEventListener("keyup", () => {})
      document.removeEventListener("click", () => {})
      renderer.dispose()
      if (containerEl.contains(renderer.domElement)) {
        containerEl.removeChild(renderer.domElement)
      }
    }
  }, [isMobile])

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-pink-50 to-pink-100">
      <div
        ref={textInputRef}
        id="text-input"
        contentEditable="true"
        className="fixed top-0 left-0 opacity-0 pointer-events-none"
      ></div>
      <div ref={containerRef} className="fixed top-0 left-0 w-full h-full"></div>

      {/* Audio element with external link - using the specified NetEase music ID */}
      <audio ref={audioRef} loop preload="auto" className="hidden">
        <source src="https://music.163.com/song/media/outer/url?id=1422912854.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {/* Music control with volume slider */}
      <div
        className="music-control fixed bottom-4 right-4 z-10"
        onMouseEnter={() => setShowVolumeControl(true)}
        onMouseLeave={() => setShowVolumeControl(false)}
      >
        {/* Volume slider */}
        <div
          className={`volume-slider absolute bottom-14 right-4 bg-pink-100 bg-opacity-80 backdrop-blur-sm p-2 rounded-lg shadow-lg transition-all duration-300 ${
            showVolumeControl
              ? "opacity-100 transform translate-y-0"
              : "opacity-0 transform translate-y-2 pointer-events-none"
          }`}
        >
          <div className="flex items-center mb-2">
            <button onClick={toggleMute} className="mr-2 text-pink-600 hover:text-pink-800 transition-colors">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 accent-pink-500"
            />
          </div>
        </div>

        {/* Music button */}
        <button
          onClick={toggleMusic}
          className="w-12 h-12 rounded-full bg-pink-100 bg-opacity-80 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-pink-200 transition-all duration-300"
        >
          {isPlaying ? <Pause className="w-5 h-5 text-pink-600" /> : <Music className="w-5 h-5 text-pink-600" />}
          <div
            className={`absolute inset-0 rounded-full border-2 border-pink-300 ${isPlaying ? "animate-ping opacity-50" : "opacity-0"}`}
          ></div>
        </button>
      </div>

      {/* Subtle instructions - larger on mobile */}
      <div
        className={`absolute bottom-4 left-0 right-0 text-center text-pink-400 ${isMobile ? "text-base font-medium" : "text-sm"} opacity-80`}
      >
        {isMobile ? "点击屏幕跳过动画" : "点击任意位置可跳过动画"}
      </div>

      {/* Restart button - redesigned as a small ball */}
      <button
        onClick={() => {
          window.location.reload()
        }}
        className={`absolute ${isMobile ? "top-3 right-3" : "top-4 right-4"} w-10 h-10 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-500 flex items-center justify-center shadow-md transition-all duration-300 hover:scale-110`}
        aria-label="重新开始"
        title="重新开始"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <path d="M3 3v5h5"></path>
        </svg>
      </button>
    </div>
  )
}
