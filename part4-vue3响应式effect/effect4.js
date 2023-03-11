const bucket = new WeakMap() 
let activeEffect 

function effect(fn) {
    // 新增修改
    const effectFn = () => {
        activeEffect = effectFn
        // 调用cleanup 函数完成清除
        cleanup(effectFn)
        fn()
    }
    // 新增activeEffect.deps 用来储存与该副作用函数相关联的依赖集合
    effectFn.deps = []
    effectFn()
    // activeEffect = fn
    // fn()
}


function cleanup(effectFn) {
    for(let i=0; i< effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        // 讲effectFn 从deps的set中删除
        deps.delete(effectFn)
    }

    // 最后需要重置 effectFn.deps 的数组
    effectFn.deps.length = 0
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

// get拦截函数，track 函数追踪变化
function track(target, key) {
    console.log("🚀 ~ file: effect4.js:50 ~ track ~ key:", key)
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

    // deps 就是一个与当前副作用函数存在联系的依赖集合
    // 将其添加到 activeEffect.deps 数组中
    activeEffect.deps.push(deps)
}

// set函数，trigger 函数触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)

    if(!depsMap) return

    const effects = depsMap.get(key)
    const effectsToRun = new Set(effects)
    effectsToRun.forEach(effectFn => effectFn())
    // effects && effects.forEach(fn => fn()) // 导致循环的根本原因
}


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
