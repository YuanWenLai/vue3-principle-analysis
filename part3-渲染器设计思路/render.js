console.log(123)


function renderer(vnode, container) {
    // 判断是标准标签还是组件
    if(typeof vnode.tag === 'string') {
        mountElement(vnode, container)
    } else if(typeof vnode.tag === 'function') {
        mountComponnet(vnode, container)
    } else if(typeof vnode.tag === 'object') {
        mountObjComponnet(vnode, container)
    }
}

function mountElement(vnode, container) {
    console.log("🚀 ~ file: render.js:6 ~ render ~ container:", container)
    const el = document.createElement(vnode.tag)

    for(const key in vnode.props) {
        el.addEventListener(
            key.substr(2).toLowerCase(),
            vnode.props[key]
        )
    }

    if(typeof vnode.children === 'string') {
        el.appendChild(document.createTextNode(vnode.children))
    } else if(Array.isArray(vnode.children)) {
        vnode.children.forEach(child => render(child, el))
    }

    container.appendChild(el)
}

function mountComponnet(vnode, container) {
    const subtree = vnode.tag()
    renderer(subtree, container)
}

function mountObjComponnet(vnode, container) {
    const subtree = vnode.tag.render()
    renderer(subtree, container)
}