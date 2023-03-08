let activeEffect 

function effect(fn) {
    activeEffect = fn
    fn()
}


// 存储副作用的桶
const bucket = new Set()

const data = {
    ok: true,
    text: 'hello world!'
}

const obj = new Proxy(data, {
    get(target, key) {
        if(activeEffect) {
            bucket.add(activeEffect)
        }
        return target[key]
    },

    set(target, key, value) {
        target[key] = value
        bucket.forEach(fn => fn())

        return true
    }
})

effect(
    () => {
        console.log("🚀 ~ file: effect1.js:25 ~ effect ~ obj.text:", obj.text)
        document.body.innerText = obj.text
    }
)


setTimeout(() => {
    obj.text = 'hello vue3 !!'
}, 2000)