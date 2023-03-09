const bucket = new WeakMap() 
let activeEffect 

// 副作用函数栈
const effectStack = []

// 副作用函数
function effect(fn, options = {}) {
    // 新增修改
    const effectFn = () => {
        // 调用cleanup 函数完成清除
        cleanup(effectFn)

        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn()

        // 在当前副作用函数执行后，讲当前副作用函数弹出栈，并把activeEffect变成栈顶的值
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]

        return res
    }

    // 4.7 将options 挂载到 effectFn 上
    effectFn.options = options

    // 新增activeEffect.deps 用来储存与该副作用函数相关联的依赖集合
    effectFn.deps = []

    // 4.8 只有非lazy才执行，否则返回函数作为值
    if(!options.lazy) {
        effectFn()
    } else {
        return effectFn
    }
    
}

// 清除副作用函数
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
    console.log("🚀 ~ file: 4.9effect-watch.js:79 ~ trigger ~ target:", target)
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

    effectsToRun.forEach(effectFn => {
        // 若一个副作用函数存在一个调度器，则用调度器，并将副作用函数作为参数传递
        if(effectFn.options.scheduler) {
            effectFn.options.scheduler(effectFn)
        } else {
            // 否则默认执行
            effectFn()
        }
    })
}

// 实现computed
function computed(getter) {
    // 缓存上一次计算的值
    let value

    // dirty 标志，true为脏，需要重新计算
    let dirty = true

    const effectFn = effect(getter, {
        lazy: true,
        scheduler() {
            dirty = true

            trigger(obj, 'value')
        }
    })

    const obj = {
        // 当读取value 时，才执行 effectFn
        get value() {
            if(dirty) {
                value = effectFn()
                dirty = false
            }
            track(obj, 'value')
            return value
        }
    }

    return obj
}

/**
* @param {string | number | function | object} source
* @param { function } cb
* @param { object } options
* @return { void }
* @description 实现watch
 */
function watch(source, cb, options = {}) {
    let getter
    if(typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source)
    }

    // 定义新旧值
    let oldVal, newVal

    // cleanup 来储存过期回调
    let cleanup
    // 定义onInvalidate函数
    function onInvalidate(fn) {
        cleanup = fn
    }

    // 提取scheduler 为一个独立的job
    const job = () => {
        // 再scheduler 中重新执行副作用函数，得到的是新值
        newVal = effectFn()
        
        // 在调用回调函数cb之前，先调用过期回调
        if(cleanup) {
            cleanup()
        } 

        cb(newVal, oldVal, onInvalidate)
        // 更新旧值
        oldVal = newVal
    }


    // 注册effect 时，开启lazy选项
    const effectFn = effect(
        // 触发读取操作，建立联系
        () => getter(),
        {
            lazy: true, 
            // 当数据发生变化时，调用cb
            scheduler: () => {
                if(options.flush === 'post') {
                    const p = Promise.resolve()
                    p.then(job)
                } else {
                    job()
                }
            }
        }
    )

    // 判断是否立即执行函数
    if(options.immediate) {
        job()
    } else {
         // 手动触发副作用函数，取得旧值
        oldVal = effectFn()
    }
}

/**
* @param { base | object }  value
* @param { Set }  seen
* @return { any }
* @description xxxx
 */
function traverse(value, seen = new Set()) {
    console.log("🚀 ~ file: 4.9effect-watch.js:151 ~ traverse ~ value:", value)
    // 若数据是原始值，or 已经被读取过，不做处理
    if(typeof value !== 'object' || value === null || seen.has(value)) return
    
    seen.add(value)

    // 若value是一个对象，使用for
    for(const k in value) {
        console.log("🚀 ~ file: 4.9effect-watch.js:159 ~ traverse ~ value:", value)
        traverse(value[k], seen)
    }
    return value
}
 
// ***********************************************************

// 定义一个任务队列
const jobQueue = new Set() // 利用set 自动去重

// 使用 Promise.resolve 创建一个 promise 实例，我们将它一个任务添加到微任务中
const p = Promise.resolve()

let isFlushing = false

function flushJob() {
    // 若队列正在刷新，则什么都不做
    if(isFlushing) return

    isFlushing = true
    
    p.then(() => {
        jobQueue.forEach(job => job())
    }).finally(() => {
        isFlushing = false
    })
}

// ***********************************************************

const data = {
    foo: 1,
    bar: {
        a: 11
    },
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

// 测试watch

watch(
    () => obj.foo, 
    (newV, oldV, onInvalidate) => {
        let expired = false
        
        onInvalidate(function() {
            console.log(" 111:", expired)
            expired = true
            console.log(" 222:", expired)
        })
        console.log(" 333:", expired)

        if(!expired) {
            console.log("newV, oldV:", newV, oldV)
            console.log('数据变化了')
        }
    }
    )

    obj.foo = 11
setTimeout(() => obj.foo = 22, 1000)
setTimeout(() => obj.foo = 33, 500)
