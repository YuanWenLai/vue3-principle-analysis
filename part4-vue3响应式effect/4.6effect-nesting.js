const bucket = new WeakMap() 
let activeEffect 

// 副作用函数栈
const effectStack = []

// 副作用函数
function effect(fn) {
    // 新增修改
    const effectFn = () => {
        // 调用cleanup 函数完成清除
        cleanup(effectFn)

        activeEffect = effectFn
        effectStack.push(effectFn)
        fn()

        // 在当前副作用函数执行后，讲当前副作用函数弹出栈，并把activeEffect变成栈顶的值
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    // 新增activeEffect.deps 用来储存与该副作用函数相关联的依赖集合
    effectFn.deps = []
    effectFn()
}

// 清楚副作用函数
function cleanup(effectFn) {
    for(let i=0; i< effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        // 讲effectFn 从deps的set中删除
        deps.delete(effectFn)
    }

    // 最后需要重置 effectFn.deps 的数组
    effectFn.deps.length = 0
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

    // deps 就是一个与当前副作用函数存在联系的依赖集合
    // 将其添加到 activeEffect.deps 数组中
    activeEffect.deps.push(deps)
}

// set函数，trigger 函数触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)

    if(!depsMap) return

    const effects = depsMap.get(key)
    const effectsToRun = new Set()

    // 如trigger 触发执行的副作用与当前正在执行副作用函数相同，则不触发执行
    effects && effects.forEach(effectFn => {
        if(effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    effectsToRun.forEach(effectFn => effectFn())
}

// ***********************************************************

const data = {
    foo: 1
}

const obj = new Proxy(data, {
    get(target, key) {
        track(target, key)
        return target[key]
    },

    set(target, key, newVal) {
        console.log("🚀 ~ file: 4.6effect-nesting.js:94 ~ set ~ target:", target)
        target[key] = newVal
        trigger(target, key)
    }
})

effect(() => {
    obj.foo++
})

// setInterval(() => {
//     console.log(obj.foo)
// }, 1000)



