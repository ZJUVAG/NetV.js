/**
 * @description render graph using webgl
 * @author Xiaodong Zhao <zhaoxiaodong@zju.edu.cn>
 */

import * as nodeShaders from './shaders/node-shader'
import * as linkShaders from './shaders/link-shader'
import { RenderNodeManager } from './elements/render-node'
import Node from '../elements/node'
import Link from '../elements/link'
import { RenderLinkManager } from './elements/render-link'
import { Transform, Position } from '../interfaces'
import { RendererConfigs } from './interfaces'
import { Color } from '../interfaces'
import { decodeRenderId } from './utils'

const MODIFIED_ELEMENTS_COUNT_UPPER_THRESHOLD = 10 // when modifiedElementCount is larger than it, $_shouldLazyUpdate will be true

export class Renderer {
    public nodeManager: RenderNodeManager
    public linkManager: RenderLinkManager

    public modifiedElementsCount = 0 // record modified link num to control lazy update
    public shouldLazyUpdate = false // flag to control lazy update

    private gl: WebGL2RenderingContext
    private backgroundColor: Color
    private width: number
    private height: number
    private idTexture: WebGLTexture

    private getAllNodes: () => Node[]
    private getAllLinks: () => Link[]

    /**
     * create renderer object
     * @param configs {canvas: HTMLCanvasElement, width: number, height: number, backgroundColor: Color, defaultConfigs: Object} configs passed to renderer
     */
    public constructor(configs: RendererConfigs) {
        const {
            canvas,
            width,
            height,
            backgroundColor,
            nodeLimit,
            linkLimit,
            getAllNodes,
            getAllLinks
        } = configs

        try {
            this.gl = canvas.getContext('webgl2')
        } catch {
            throw new Error('NetV requires WebGL2 supported by your browser')
        }

        this.backgroundColor = backgroundColor
        this.width = width
        this.height = height

        this.getAllNodes = getAllNodes
        this.getAllLinks = getAllLinks

        this.initIdTexture()

        const nodeShaderSeriels = {
            vertex: nodeShaders.vertex.connect(),
            fragment: nodeShaders.fragment.connect(),
            idVertex: nodeShaders.idVertex.connect(),
            idFragment: nodeShaders.idFragment.connect()
        }

        const linkShaderSeriels = {
            vertex: linkShaders.vertex.connect(),
            fragment: linkShaders.fragment.connect(),
            idVertex: linkShaders.idVertex.connect(),
            idFragment: linkShaders.idFragment.connect()
        }

        this.nodeManager = new RenderNodeManager(
            this.gl,
            { width, height, limit: nodeLimit },
            nodeShaderSeriels,
            this.idTexture
        )
        this.linkManager = new RenderLinkManager(
            this.gl,
            { width, height, limit: linkLimit },
            linkShaderSeriels,
            this.idTexture
        )
    }

    /**
     * dispose renderer stuffs
     */
    public dispose() {
        // refer: https://stackoverflow.com/a/23606581
        const numTextureUnits = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS)
        for (let unit = 0; unit < numTextureUnits; ++unit) {
            this.gl.activeTexture(this.gl.TEXTURE0 + unit)
            this.gl.bindTexture(this.gl.TEXTURE_2D, null)
            this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null)
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null)
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
        this.gl.getExtension('WEBGL_lose_context').loseContext()
        // TODO: maybe need free more buffers or something else
    }

    /**
     * set clearColor for renderer
     * @param color
     */
    public setBackgroundColor(color: Color) {
        this.backgroundColor = color
    }

    /**
     * clear data in renderer
     */
    public clearData() {
        this.nodeManager.clearData()
        this.linkManager.clearData()
    }

    /**
     * add nodes to node manager
     * @param nodes node data in NetV
     */
    public addNodes(nodes: Node[]) {
        this.nodeManager.addData(nodes)
    }

    /**
     * add links to link manager
     * @param links link data in NetV
     */
    public addLinks(links: Link[]) {
        this.linkManager.addData(links)
    }

    public setTransform(transform: Transform) {
        this.nodeManager.setTransform(transform)
        this.linkManager.setTransform(transform)
    }

    /**
     * draw all elements
     */
    public draw() {
        if (this.shouldLazyUpdate) {
            // TODO: not only position needs to be refreshed, but also other styles
            this.nodeManager.refreshPosition(this.getAllNodes())

            this.linkManager.refreshPosition(this.getAllLinks())
            this.shouldLazyUpdate = false
            this.modifiedElementsCount = 0
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.idTexture)
        this.gl.clearColor(1, 1, 1, 1)
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)

        this.gl.clearColor(
            this.backgroundColor.r,
            this.backgroundColor.g,
            this.backgroundColor.b,
            this.backgroundColor.a
        )
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
        this.linkManager.draw()
        this.nodeManager.draw()
    }

    /**
     * get element's id at (x, y) of canvas if exists
     * @param x x pos
     * @param y y pos
     */
    public getIdByPosition(position: Position): string | [string, string] {
        const renderId = this.readIdTexture(position)
        if (renderId >= 0) {
            if (renderId % 2 === 0) {
                // NOTE: node has even render id, link has odd render id
                const node = this.nodeManager.getElementByRenderId(renderId) as Node
                return node.id()
            } else {
                const link = this.linkManager.getElementByRenderId(renderId) as Link
                const sourceTarget = link.sourceTarget()
                return [sourceTarget.source.id(), sourceTarget.target.id()]
            }
        }
    }

    /**
     * read pixel value at (x, y) of texture
     * @param x x pos
     * @param y y pos
     */
    public readIdTexture(position: Position): number {
        const ratio = window.devicePixelRatio || 1
        this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, this.idTexture)
        const readPixelBuffer = new Uint8Array([255, 255, 255, 255]) // -1
        this.gl.readPixels(
            // !Warning: x and y are optional in Position, need to check them
            position.x * ratio,
            position.y * ratio,
            1,
            1,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            readPixelBuffer
        )
        const objectID = decodeRenderId(readPixelBuffer)

        return objectID
    }

    /**
     * increase modified elements count
     * When it is larger than a threshold, the lazy update mode will be turned on.
     */
    public increaseModifiedElementsCountBy(n: number) {
        this.modifiedElementsCount += n
        if (this.modifiedElementsCount > MODIFIED_ELEMENTS_COUNT_UPPER_THRESHOLD) {
            this.shouldLazyUpdate = true
        }
    }

    /**
     * init WebGL texture for recording position of elements
     */
    private initIdTexture() {
        const gl = this.gl
        const pixelRatio = window.devicePixelRatio || 1
        const screenWidth = this.width * pixelRatio
        const screenHeight = this.height * pixelRatio

        const fbo = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

        const idTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, idTexture)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            screenWidth,
            screenHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.bindTexture(gl.TEXTURE_2D, null)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, idTexture, 0)

        // TODO: need simplify
        gl.drawBuffers([0].map((v) => v + gl.COLOR_ATTACHMENT0))

        const rbo = gl.createRenderbuffer()
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
        gl.clearColor(1, 1, 1, 1)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, screenWidth, screenHeight)
        gl.bindRenderbuffer(gl.RENDERBUFFER, null)
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_STENCIL_ATTACHMENT,
            gl.RENDERBUFFER,
            rbo
        )

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer generate failed')
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        this.idTexture = fbo
    }
}
