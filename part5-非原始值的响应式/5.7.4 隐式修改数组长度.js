const bucket = new WeakMap() 
let activeEffect 

// 副作用函数栈
const effectStack = []

const ITERATE_KEY = Symbol()

// 定义一个Map，储存原始对象到代理对象的映射
const reactiveMap = new Map()

// 5.7.4 代表是否进行追踪
let shouldTrack = true

const TrrigerType = {
    SET: 'SET',
    ADD: 'ADD',
    DELETE: 'DELETE',
}

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
    // 5.7.4 当禁止追踪时，直接返回
    if(!shouldTrack) return
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

/**
* @param {object} target
* @param {string} key
* @param {string} type // type为ADD 时，才触发与ITERATE_KEY相关的副作用函数
* @return {void} 
* @description set函数，trigger 函数触发变化
 */
function trigger(target, key ,type) {
    const depsMap = bucket.get(target)
    if(!depsMap) return

    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    

    // 取得与ITERATE_KEY的联系
    if(type === TrrigerType.ADD || type === TrrigerType.DELETE) {
        const iterateEffects = depsMap.get(ITERATE_KEY)
         // 将 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
        iterateEffects && iterateEffects.forEach(effectFn => {
            if(effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }

    // 如trigger 触发执行的副作用与当前正在执行副作用函数相同，则不触发执行
    effects && effects.forEach(effectFn => {
        if(effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })

    // 5.7.1 当操作类型为ADD，并且目标对象是数组时，应该取出与length属性相关的副作用函数
    if((type === TrrigerType.ADD || type === TrrigerType.SET) && Array.isArray(target)) {
        // 取出与length相关的副作用函数
        const lengthEffects = depsMap.get('length')
        lengthEffects && lengthEffects.forEach(effectFn => {
            if(effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
   

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
    // 若数据是原始值，or 已经被读取过，不做处理
    if(typeof value !== 'object' || value === null || seen.has(value)) return
    
    seen.add(value)

    // 若value是一个对象，使用for
    for(const k in value) {
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


// 5.7.3 重写数组的查找方法
const findArrayMethodArr = ['includes', 'indexOf', 'lastIndexOf']
const operatArrayMethodArr = ['push', 'pop', 'shift', 'unshift', 'splice']
const arrayInstumentations = {}

findArrayMethodArr.forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstumentations[method] = function(...args) {
        // this 是代理对象，先在代理中查找，将结果存储到res中
        let res = originMethod.apply(this, args)

        if(res === false) {
            // 没有找到，再去原始数组中查找
            res = originMethod.apply(this.raw, args)
        }
        return res
    }
})

operatArrayMethodArr.forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstumentations[method] = function(...args) {
        shouldTrack = false
        let res = originMethod.apply(this, args)
        shouldTrack = true
        return res
    }
})


/**
* @param {object} obj
* @param {boolean} isShallow
* @return {void}
* @description reactive 函数
 */

function createReactive(obj, isShallow = false, isReadonly = false) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            // 5.4
            if(key === 'raw') {
                return target
            }

            // 5.7.3 若操作对象是数组，并且是数组的查找方法
            if(Array.isArray(target) && arrayInstumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstumentations, key, receiver)
            }

            // 5.6 非只读时，才建立响应
            // 5.7.1 是数组时，设置length 为key
            if(!isReadonly && typeof key !== 'symbol') {
                track(target, Array.isArray(target) ? 'length' : key)
            } 
            
            const res = Reflect.get(target, key, receiver)

            // 5.5 若是浅响应，直接返回原始值
            if(isShallow) {
                return res
            }
            // 5.5 若是深响应，递归获取
            if(typeof res === 'object' && res !== null) {
                return isReadonly ?　readOnlyReactive(res) : reactive(res)
            }
            return res
        },
    
        set(target, key, newVal, receiver) {
            if(isReadonly) {
                console.warn(`属性${key} 只读`)
                return true
            }
            const oldVal = target[key]
            // 若属性不存在，则是添加，否则是设置
            // 5.7.1 
            // 若目标是数组，则检查是否添加or修改
            const  type = Array.isArray(target)
            ? Number(key) < target.length ?　TrrigerType.SET : TrrigerType.ADD
            : Object.prototype.hasOwnProperty.call(target, key) ? TrrigerType.SET : TrrigerType.ADD
            const res = Reflect.set(target, key, newVal, receiver)
    
            // 5.4 当receiver就是target的代理对象时，才触发，避免原型链向上触发
            if(target === receiver.raw) {
                if(oldVal !== newVal &&(oldVal === oldVal || newVal === newVal)) {
                    console.log("🚀 ~ file: 5.7.3 数组查找.js:345 ~ set ~ key:", key)
                    trigger(target, key, type)
                }
            }
            
            return res
        },
        ownKeys(target) {
            // 将副作用函数与 ITERATE_KEY 关联
            track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
            return Reflect.ownKeys(target)
        },
        deleteProperty(target, key) {
            if(isReadonly) {
                console.warn(`属性${key} 只读`)
                return true
            }
            const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    
            const res = Reflect.deleteProperty(target, key)
    
            if(res && hadKey) {
                trigger(target, key, TrrigerType.DELETE)
            }
    
            return res
        }
    })
}


// 深响应
// 5.7.3 解决对象指针丢失
function reactive(obj) {
    // 5.7.3 优先通过原始对象obj 寻找之前的代理对象
    const existionProxy = reactiveMap.get(obj)
    if(existionProxy) return existionProxy

    // 否则，创建新的代理对象
    const proxy = createReactive(obj)
    reactiveMap.set(obj, proxy)
    return proxy
}

// 浅响应
function shallowReactive(obj) {
    return createReactive(obj, true)
}

// 深只读
function readOnlyReactive(obj) {
    return createReactive(obj, false, true)
}

// 浅只读
function shallowReadOnlyReactive(obj) {
    return createReactive(obj, true, true)
}
// ***********************************************************

// test 

const arr = reactive([1,2])

effect(() => {
    // console.log("🚀 ~ file: 5.7.3 数组查找.js:392 ~ arr:", ...arr)
    arr.push(3)
})

effect(() => {
    console.log("🚀 ~ file: 5.7.3 数组查找.js:392 ~ arr:", ...arr)
    arr.push(4)
})
// arr.length = 0


arr.push(5)





