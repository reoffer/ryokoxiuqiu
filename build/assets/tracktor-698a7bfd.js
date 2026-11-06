function L() {
    import.meta.url,
        import ("_").catch(() => 1);
    async function* t() {}
}

function p(t) {
    return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t
}

function w(t) {
    return c(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, t)
}

function v(t) {
    return c(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/, t)
}

function y(t) {
    return c(/^\+?[0-9]{1,4}?[-.\s]?(?:\([0-9]{1,4}\)|[0-9]{1,4})[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}$/, t)
}

function c(t, e) {
    return typeof e != "string" ? !1 : t.test(e.trim())
}
var k = {
    validateUUID: w,
    validateEmail: v,
    validatePhoneNumber: y,
    validateRegex: c
};

function d() {
    const e = window.location.hostname.split("."),
        r = new Set([".co.uk", ".com.au", ".co.jp", ".co.in", ".com.br", ".com.mx"]);
    for (let i = 0; i < e.length - 1; i++) {
        const a = "." + e.slice(i).join(".");
        if (r.has(a)) return e.slice(i - 1).join(".")
    }
    return e.slice(-2).join(".")
}

function E() {
    const t = window.location.protocol,
        e = d();
    return "".concat(t, "//tracktor.").concat(e)
}
var q = {
    getMainDomain: d,
    getFirstPartyTrackingDomain: E
};
let M = class {
    constructor() {
        this.queue = [], this.lock = !1, this.processing = !1, this.initBuffer = []
    }
    async acquire(e = 5e3) {
        const r = Date.now();
        for (; this.lock;) {
            if (Date.now() - r > e) {
                console.error("Lock acquisition timeout"), this.lock = !1;
                break
            }
            await new Promise(i => setTimeout(i, 10))
        }
        return this.lock = !0, !0
    }
    release() {
        this.lock = !1
    }
    async enqueue(e, r) {
        if (!r) {
            this.initBuffer.push(e);
            return
        }
        this.queue.push(e), this.processing || await this.processQueue()
    }
    async processInitBuffer() {
        for (const e of this.initBuffer) await this.enqueue(e, !0);
        this.initBuffer = []
    }
    async processQueue() {
        if (!this.processing) {
            await this.acquire();
            try {
                for (this.processing = !0; this.queue.length > 0;) {
                    const e = this.queue.shift();
                    try {
                        await e()
                    } catch (r) {
                        console.error("Error processing tracktor event:", e, r)
                    }
                }
            } finally {
                this.processing = !1, this.release()
            }
        }
    }
};
var T = M;
let P = class {
    constructor() {
        this.iframe = null
    }
    initialize(e, r) {
        this.iframe = document.createElement("iframe"), this.iframe.width = "1", this.iframe.height = "1", this.iframe.style.border = "0", this.iframe.onload = () => {
            r()
        }, this.iframe.onerror = () => {
            throw new Error("Tracktor Iframe failed to load")
        }, this.iframe.src = e, document.body.appendChild(this.iframe)
    }
    async postMessage(e, r, i) {
        if (!this.iframe || !e) throw new Error("Tracktor not initialized properly");
        const a = {
            type: r,
            detail: i
        };
        this.iframe.contentWindow.postMessage(a, "*")
    }
};
var b = P;
const {
    validateUUID: $,
    validateEmail: D,
    validatePhoneNumber: I,
    validateRegex: N
} = k, {
    getFirstPartyTrackingDomain: B
} = q, _ = T, z = b;
let x = class {
    constructor(e = null) {
        this.url = e || B(), this.initialized = !1, this.queueManager = new _, this.iframeManager = new z, this.customEventsBuffer = [], this.pageViewCompleted = !1, this.setupRecordedEventListener()
    }
    setupRecordedEventListener() {
        window.addEventListener("message", e => {
            if (e.data && e.data.type === "client:recorded" && (this.pageViewCompleted = !0, this.customEventsBuffer.length > 0)) {
                const r = [...this.customEventsBuffer];
                this.customEventsBuffer = [], r.forEach(i => {
                    this.enqueue(i)
                })
            }
        })
    }
    async acquire(e = 5e3) {
        return this.queueManager.acquire(e)
    }
    release() {
        this.queueManager.release()
    }
    async enqueue(e) {
        return this.queueManager.enqueue(e, this.initialized)
    }
    async waitForQueueEmpty() {
        return this.queueManager.queue.length === 0 && !this.queueManager.processing ? Promise.resolve() : new Promise(e => {
            const r = () => {
                this.queueManager.queue.length === 0 && !this.queueManager.processing ? e() : setTimeout(r, 10)
            };
            r()
        })
    }
    initialize(e) {
        if (!$(e)) throw new Error("Tracktor - invalid UUID");
        this.uuid = e, this.iframeManager.initialize(this.url, () => {
            this.initialized = !0, this.queueManager.processInitBuffer()
        })
    }
    async pageView(e, r, i, a) {
        let n = {
            uuid: this.uuid,
            data: e,
            url: window.location.href,
            related_uuid: i,
            referrer: document.referrer || a || ""
        };
        return r && (n.segments = r), this.enqueue(() => this.postMessage(this.uuid, "recordVisit", n))
    }
    async postMessage(e, r, i) {
        return this.iframeManager.postMessage(e, r, i)
    }
    async recordEmail(e) {
        if (D(e)) return this.enqueue(() => this.postMessage(this.uuid, "recordEmail", {
            uuid: this.uuid,
            email: e
        }))
    }
    async recordPhone(e) {
        if (I(e)) return this.enqueue(() => this.postMessage(this.uuid, "recordPhone", {
            uuid: this.uuid,
            phone: e
        }))
    }
    async customEvent(e, r = {}) {
        if (!e || typeof e != "string") {
            console.error("Tracktor - invalid event name. Event name must be a non-empty string.");
            return
        }
        const i = () => this.postMessage(this.uuid, "customEvent", {
            uuid: this.uuid,
            name: e,
            data: r
        });
        return this.pageViewCompleted ? this.enqueue(i) : (this.customEventsBuffer.push(i), Promise.resolve())
    }
};
var U = x;
const j = U;
var Q = j;
const V = p(Q);

function A(t, {
    pageVisitUrl: e,
    brand: r,
    category: i,
    slug: a,
    params: n
}) {
    const f = {};
    t.addEventListener("message", function(s) {
        var h;
        if (!t.tracktor || ((h = s.data) == null ? void 0 : h.type) !== "client:recorded" || s.origin !== new URL(t.tracktor.url).origin) return;
        const o = Array.isArray(s.data.data) ? s.data.data.filter(Boolean) : [],
            l = o.filter(function(u, m) {
                return o.indexOf(u) === m && !f[u]
            });
        l.length && (l.forEach(function(u) {
            f[u] = !0
        }), g(l))
    });

    function g(s) {
        t.fetch(e, {
            method: "POST",
            keepalive: !0,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                brand: r,
                category: i,
                slug: a,
                emails: s,
                params: n
            })
        }).catch(function(o) {
            console.error("Iterable pageVisit failed: ", o)
        })
    }
}

function C(t, e) {
    const r = {};
    return e.forEach(function(i) {
        t[i] !== void 0 && (r[i] = t[i])
    }), r
}
const F = new V;
window.tracktor = F;
window.orbIterablePageVisit = A;
window.orbSelectTrackedParams = C;
window.dispatchEvent(new Event("tracktor:init"));
export {
    L as __vite_legacy_guard
};