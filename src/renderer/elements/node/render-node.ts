/**
 * @author Xiaodong Zhao <zhaoxiaodong@zju.edu.cn>
 * @description Node using in Renderer
 */

import vertShaderStr from './vertex.glsl'
import fragShaderStr from './fragment.glsl'
import { createProgram, createArrayBuffer } from '../../utils'
import { RenderAttribute, Transform } from '../../interfaces'
import Node from '../../../node'

enum NodeAttrKey {
    Template,
    Position,
    Size,
    Color,
    StrokeWidth,
    StrokeColor
}

export class RenderNodeManager {
    // program
    private gl: WebGL2RenderingContext
    private limit: number
    private count = 0
    private width: number
    private height: number
    private program: WebGLProgram
    private attributes: RenderAttribute

    /**
     * create render node manager
     * @param gl WebGL context
     * @param width canvas width
     * @param height canvas height
     * @param limit max nodes number
     */
    public constructor(gl: WebGL2RenderingContext, width: number, height: number, limit: number) {
        this.gl = gl
        this.limit = limit
        this.width = width
        this.height = height

        this.attributes = [
            {
                name: 'inVertexPos',
                index: 0,
                size: 3,
                isBuildIn: true
            },
            {
                name: 'inPosition',
                index: 1,
                size: 2
            },
            {
                name: 'inRadius',
                index: 2,
                size: 1
            },
            {
                name: 'inFill',
                index: 3,
                size: 4
            },
            {
                name: 'inStrokeWidth',
                index: 4,
                size: 1
            },
            {
                name: 'inStrokeColor',
                index: 5,
                size: 4
            }
        ]

        this.program = createProgram(this.gl, vertShaderStr, fragShaderStr, this.attributes)

        // init arrays
        // prettier-ignore
        this.attributes[NodeAttrKey.Template].array = new Float32Array([
            -0.5, 0.0, 1.0,
            0.0, -0.5, 1.0,
            0.0, 0.5, 1.0,
            0.5, 0.0, 1.0,
        ])
        this.attributes.forEach((attr) => {
            if (!attr.isBuildIn) attr.array = new Float32Array(attr.size * this.limit)
        })

        // init buffers
        this.attributes.forEach((attr) => {
            attr.buffer = createArrayBuffer(this.gl, attr.array)
        })

        // init uniforms
        this.gl.useProgram(this.program)
        const projectionLoc = this.gl.getUniformLocation(this.program, 'projection')
        const scaleLoc = this.gl.getUniformLocation(this.program, 'scale')
        const translateLoc = this.gl.getUniformLocation(this.program, 'translate')
        const viewportLoc = this.gl.getUniformLocation(this.program, 'viewport')

        // this.gl.viewport(0, 0, this.width, this.height) // TODO: viewport set, not needed? put here in case bug appear

        // prettier-ignore
        const projection = new Float32Array([
            2 / this.width, 0, 0,
            0, -2 / this.height, 0,
            -1, 1, 1
        ])
        this.gl.uniformMatrix3fv(projectionLoc, false, projection)

        const scale = new Float32Array([1, 1])
        this.gl.uniform2fv(scaleLoc, scale)

        const translate = new Float32Array([0, 0])
        this.gl.uniform2fv(translateLoc, translate)

        const viewport = new Float32Array([this.width, this.height])
        this.gl.uniform2fv(viewportLoc, viewport)
    }

    /**
     * set Transform in Render Node
     * @param transform current transform(pan&zoom condition)
     */
    public setTransform(transform: Transform) {
        this.gl.useProgram(this.program)
        const scaleLoc = this.gl.getUniformLocation(this.program, 'scale')
        const translateLoc = this.gl.getUniformLocation(this.program, 'translate')

        const scale = new Float32Array([transform.k, transform.k])
        this.gl.uniform2fv(scaleLoc, scale)

        const translate = new Float32Array([transform.x, transform.y])
        this.gl.uniform2fv(translateLoc, translate)
    }

    /**
     * add nodes data to engine
     * @param nodes nodes data
     */
    public addData(nodes: Node[]) {
        // set array
        nodes.forEach((node, i) => {
            // TODO: consider node and render node attribute mapping
            const position = node.position()
            this.attributes[NodeAttrKey.Position].array[2 * (this.count + i)] = position.x
            this.attributes[NodeAttrKey.Position].array[2 * (this.count + i) + 1] = position.y

            this.attributes[NodeAttrKey.Size].array[this.count + i] = node.r()

            const fill = node.fill()
            this.attributes[NodeAttrKey.Color].array[4 * (this.count + i)] = fill.r
            this.attributes[NodeAttrKey.Color].array[4 * (this.count + i) + 1] = fill.g
            this.attributes[NodeAttrKey.Color].array[4 * (this.count + i) + 2] = fill.b
            this.attributes[NodeAttrKey.Color].array[4 * (this.count + i) + 3] = fill.a

            this.attributes[NodeAttrKey.StrokeWidth].array[this.count + i] = node.strokeWidth()

            const strokeColor = node.strokeColor()
            this.attributes[NodeAttrKey.StrokeColor].array[4 * (this.count + i)] = strokeColor.r
            this.attributes[NodeAttrKey.StrokeColor].array[4 * (this.count + i) + 1] = strokeColor.g
            this.attributes[NodeAttrKey.StrokeColor].array[4 * (this.count + i) + 2] = strokeColor.b
            this.attributes[NodeAttrKey.StrokeColor].array[4 * (this.count + i) + 3] = strokeColor.a
        })

        this.attributes.forEach((attr) => {
            if (!attr.isBuildIn) {
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, attr.buffer)
                this.gl.bufferSubData(
                    this.gl.ARRAY_BUFFER,
                    attr.size * this.count * attr.array.BYTES_PER_ELEMENT,
                    attr.array,
                    attr.size * this.count,
                    attr.size * nodes.length
                )
            }
        })

        this.count += nodes.length
    }

    /**
     * draw nodes
     */
    public draw() {
        if (this.count > 0) {
            this.gl.useProgram(this.program)
            this.attributes.forEach((attr) => {
                this.gl.enableVertexAttribArray(attr.index)
            })

            this.attributes.forEach((attr, i) => {
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, attr.buffer)
                this.gl.vertexAttribPointer(
                    attr.index,
                    attr.size,
                    this.gl.FLOAT,
                    false,
                    attr.size * attr.array.BYTES_PER_ELEMENT,
                    0
                )
                if (!attr.isBuildIn) this.gl.vertexAttribDivisor(attr.index, 1)
            })
        }

        this.gl.drawArraysInstanced(this.gl.TRIANGLE_STRIP, 0, 4, this.count)
    }
}
