// 存储副作用的桶
const bucket = new Set()

const data = {
    text: 'hello world!'
}

const obj = new Proxy(data, {
    get(target, key) {
        bucket.add(effect)

        return target[key]
    },

    set(target, key, value) {
        target[key] = value
        bucket.forEach(fn => fn())

        return true
    }
})

function effect() {
    console.log("🚀 ~ file: effect1.js:25 ~ effect ~ obj.text:", obj.text)
    document.body.innerText = obj.text
}

effect()

setTimeout(() => {
    obj.text = 'hello vue3 !!'
}, 2000)