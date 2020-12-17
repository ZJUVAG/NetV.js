/**
 * @author Xiaodong Zhao <zhaoxiaodong@zju.edu.cn>
 * @description Link used in renderer
 */
import { LinkManagerConfigs, ShaderSeries } from '../interfaces'
import Link from '../../elements/link'
import { RenderElementManager } from './render-element'

export class RenderLinkManager extends RenderElementManager {
    /**
     * create render link manager
     * @param gl WebGL context
     * @param params nessesary configs for link manager
     * @param idTexture texture store elements id of each pixel
     */
    public constructor(
        gl: WebGL2RenderingContext,
        params: LinkManagerConfigs,
        shaders: ShaderSeries,
        idTexture: WebGLTexture
    ) {
        super(
            /* webgl context */ gl,
            // prettier-ignore
            /* parameters */ {...params, instanceVerteces: [
                -0.5, 0.5, 1.0,
                -0.5, -0.5, 1.0,
                0.5, 0.5, 1.0,
                0.5, -0.5, 1.0,
            ]},
            /* shader series */ {
                ...shaders
            },
            /* idTexture */ idTexture
        )
        this.renderIdToElement = {}

        this.attributes.forEach((attr) => {
            if (attr.name === 'in_source') {
                attr.extractAttributeValueFrom = (link: Link) => {
                    const sourcePosition = link.source().position()
                    return [sourcePosition.x, sourcePosition.y]
                }
            } else if (attr.name === 'in_target') {
                attr.extractAttributeValueFrom = (link: Link) => {
                    const targetPosition = link.target().position()
                    return [targetPosition.x, targetPosition.y]
                }
            } else if (attr.name === 'in_strokeWidth') {
                attr.extractAttributeValueFrom = (link: Link) => {
                    return [link.strokeWidth() * this.pixelRatio]
                }
            } else if (attr.name === 'in_strokeColor') {
                attr.extractAttributeValueFrom = (link: Link) => {
                    const strokeColor = link.strokeColor()
                    return [strokeColor.r, strokeColor.g, strokeColor.b, strokeColor.a]
                }
            }
        })
    }

    /**
     * refresh all position of edges
     * @param links all link data
     */
    public refreshPosition(links: Link[]) {
        const sourceAttr = this.attributes.get('in_source')
        const targetAttr = this.attributes.get('in_target')

        const sourceArray = sourceAttr.array
        const targetArray = targetAttr.array
        for (let i = 0; i < links.length; ++i) {
            const link = links[i]
            const source = link.$_source
            const sourcePosition = source.$_position
            sourceArray[2 * i] = sourcePosition.x
            sourceArray[2 * i + 1] = sourcePosition.y

            const target = link.$_target
            const targetPosition = target.$_position
            targetArray[2 * i] = targetPosition.x
            targetArray[2 * i + 1] = targetPosition.y
        }

        const arr = [sourceAttr, targetAttr]

        arr.forEach((attr) => {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, attr.buffer)
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, attr.array, 0, attr.size * links.length)
        })
    }
}
