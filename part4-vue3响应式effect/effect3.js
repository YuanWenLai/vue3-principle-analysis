const bucket = new WeakMap() 

let activeEffect 
function effect(fn) {
    activeEffect = fn
    fn()
}

// get拦截函数，track 函数追踪变化
function track(target, key) {
    if(!activeEffect) return target[key]

    // 根据target取出depsMap
    let depsMap = bucket.get(target)

    // 不存在，新建一个map 与 target 关联
    if(!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }

    let deps = depsMap.get(key)
    
    // 若不存在，新建一个set与key 关联
    if(!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(activeEffect)

}

// set函数，trigger 函数触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)

    if(!depsMap) return

    const effects = depsMap.get(key)
    effects && effects.forEach(fn => fn())
}


const data = {
    ok: true,
    text: 'hello world!'
}

const obj = new Proxy(data, {
    get(target, key) {
        track(target, key)
        return target[key]
    },

    set(target, key, newVal) {
        target[key] = newVal
        trigger(target, key)
    }
})


effect(
    () => {
        console.log('执行副作用')
        document.body.innerText = obj.ok ? obj.text : 'bu ok'
    }
)


setTimeout(() => {
    obj.ok = false
}, 2000)

setTimeout(() => {
    obj.text = 'text'
}, 3000)

/**
 * 共执行3次
 * 初始化一次
 * 修改ok值一次
 * 修改text值一次
 * 但是ok值为false，没有必要再执行text的effect，因此要优化
 * **/ 
