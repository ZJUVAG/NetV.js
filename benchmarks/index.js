/**
 * @author Xiaodong Zhao<zhaoxiaodong@zju.edu.cn> and Jiacheng Pan <panjiacheng@zju.edu.cn>
 * @description benchmark, FPS of NetV.js
 */

import { RESULT, STEP, TEST_FUNCS_INDEX } from './configs'
import testNetV from './testFuncs/netv.test'
import testStardust from './testFuncs/stardust.test'
import testSigma from './testFuncs/sigma.test'
import testCytoscape from './testFuncs/cytoscape.test'
import testD3Canvas from './testFuncs/d3.canvas.test'
import testD3SVG from './testFuncs/d3.svg.test'
import testG from './testFuncs/g.test'
import { initPage, reloadPage, download, json2csv } from './lib/utils'
import { TestCase } from './TestCase'
import { drawLineChart } from './lib/linechart'

// does it need to clear local storage?
initPage()

const result = localStorage.getItem(RESULT) || '{}'
const reportDiv = document.querySelector('div#result')
drawLineChart(reportDiv, JSON.parse(result))
createDownloadButton({
    container: reportDiv,
    text: 'Download JSON Result',
    data: result,
    type: 'json'
})

createDownloadButton({
    container: reportDiv,
    text: 'Download CSV Result',
    data: json2csv(JSON.parse(result)),
    type: 'csv'
})

const numbersOfNodes = [1e2, 5e2, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 1e6] // ! NOTE: the array should be ascending
// const numbersOfNodes = [5e3, 1e4, 2e4, 5e4, 1e5, 2e5] // ! NOTE: the array should be ascending
const density = 20

const testFuncs = [
    {
        name: 'G',
        func: testG
    },
    {
        name: 'NetV',
        func: testNetV
    },
    {
        name: 'D3SVG',
        func: testD3SVG
    },
    {
        name: 'D3Canvas',
        func: testD3Canvas
    },
    {
        name: 'Cytoscape',
        func: testCytoscape
    },
    {
        name: 'Sigma.js (webgl)',
        func: testSigma
    },
    {
        name: 'Stardust',
        func: testStardust
    }
]

const step = localStorage.getItem(STEP)
let testFuncsIndex = localStorage.getItem(TEST_FUNCS_INDEX)

if (!step || step === '0') {
    if (testFuncsIndex === undefined || testFuncsIndex === null) {
        testFuncsIndex = 0
    } else {
        testFuncsIndex = Number(testFuncsIndex)
        testFuncsIndex += 1
    }
}

localStorage.setItem(TEST_FUNCS_INDEX, testFuncsIndex.toString())

const testFunc = testFuncs[testFuncsIndex].func

const testCase = new TestCase({
    numbersOfNodes,
    numbersOfLinks: numbersOfNodes.map((n) => n * density),
    name: testFuncs[testFuncsIndex].name
})

test(testCase, testFunc)

async function test(testCase, testFunc) {
    let isRefreshed = true
    const timeout = setTimeout(function () {
        // wait 10 seconds if no response
        if (document.querySelector('#container').childElementCount === 0) {
            testCase.FPS = 0
            reloadPage()
        }
    }, 10000)
    await testFunc(testCase)
    clearTimeout(timeout)
    isRefreshed = testCase.finish()

    // if not reload
    if (!isRefreshed && Number(testFuncsIndex) + 1 >= testFuncs.length) {
        localStorage.clear()
    } else {
        reloadPage()
    }
}

function createDownloadButton({ container, text, data, type }) {
    const downloader = document.createElement('button')
    container.appendChild(downloader)
    downloader.textContent = text
    downloader.onclick = function () {
        const time = new Date()
        const timestamp = [
            time.getFullYear(),
            time.getMonth(),
            time.getDate(),
            time.getHours(),
            time.getMinutes(),
            time.getSeconds()
        ].join('-')
        download(data, `result-${timestamp}.${type}`, 'text/plain')
    }
}
