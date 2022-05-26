const fs = require('fs-extra');
const path = require('path');
const glob = require('util').promisify(require("glob"));
const showdown = require('showdown')
const showdownHighlight = require("showdown-highlight")
let converter = new showdown.Converter({metadata: true, tables: true, extensions: [showdownHighlight({pre: true})]})

// sections in the metadata that get added to template
const METADATA_SECTIONS = ['title', 'date']

const INDEX_LIST_VAR = 'pages'
const TEMPLATE_CONTENT_VAR = 'content'

class HtmlTemplate {
    constructor(html) {this.html = html}
    add(key, content) {return new HtmlTemplate(this.html.replace(new RegExp(`{{ *${key} *}}`,'g'), content))}
    static fromFile(path) {return new HtmlTemplate(fs.readFileSync(path).toString())}
}

const index = HtmlTemplate.fromFile("layout/index.html")
const template = HtmlTemplate.fromFile("layout/template.html")

async function main(){

    const public = path.join(__dirname, '/public'), source = path.join(public, '/_source')
    await fs.emptyDir('./output', {recursive: true, force: true});
    await fs.copy(path.join(__dirname, '/src'), public)
    await fs.copy(path.join(__dirname, '/layout'), source, {filter: i=>i.split('.').pop()!='html'})

    const pages = (await glob('public/**/*'))
        .filter(f => !f.includes("node_modules/"))
        .filter(f => f.length!=2 && f.lastIndexOf(".md") == f.length - 3)
        .map(parseMarkdownFile)

    pages.forEach(i => makeTemplate(...i))
        
    fs.writeFile("./public/index.html", index.add(INDEX_LIST_VAR, getPageList(pages)).html,()=>{})
}


async function makeTemplate(html, title, newPath, date, metadata){
    // 
    let result = template.add(TEMPLATE_CONTENT_VAR, html)
    METADATA_SECTIONS.forEach(i => result = result.add(i, getMetadata(metadata, i)))
    result = result.html

    

    const relative = (source, location) => path.relative(path.dirname(location),path.join("./public/_source",source))

    const imports = (await glob('layout/**/*')).map(i => i.replace("layout/","")).filter(i => !['html','htm'].includes(i.split('.').pop()))
    imports.forEach(i => result = result.replace(new RegExp(`(?<=href=")\/?${i}\/?(?=")`,'g'), relative(i, newPath)))

    fs.writeFile(newPath, result,()=>{})
}


const getPageList = (pages) => {
    const toHtmlLink = (file) => file.substr(0,file.lastIndexOf(".")).replace('public'+path.sep, '')
    const listItems = pages.map(([h, title, file]) =>`<li><a href="${toHtmlLink(file)}">${title}</a></li>`).join("\n")
    return "<ul>\n" + listItems + "</ul>"
}

const parseMarkdownFile = filename => {
    const html = converter.makeHtml(fs.readFileSync(filename).toString())
    const metadata = converter.getMetadata(true).split('\n')
    const title = getMetadata(metadata, 'title')
    const newPath = path.join(path.dirname(filename), (title.toLowerCase().replaceAll(" ","-")+".html"))
    const date = getMetadata(metadata, 'date')
    return [html, title, newPath, date, metadata]
}

const getMetadata = (data,key) => data.filter(i=>i.toLocaleLowerCase().substring(0,key.length)==key).map(i=>i.substring(i.indexOf(":")+1).trim())[0]

main()