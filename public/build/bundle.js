
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.57.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Notifications\Notification.svelte generated by Svelte v3.57.0 */

    const file$3 = "src\\Notifications\\Notification.svelte";

    // (41:6) {:else}
    function create_else_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("sent you a private message");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(41:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (39:42) 
    function create_if_block_7(ctx) {
    	let t0;
    	let a;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("left the group ");
    			a = element("a");
    			t1 = text(/*leftGroup*/ ctx[6]);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "class", "notification__group svelte-1arijb9");
    			add_location(a, file$3, 39, 23, 1498);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*leftGroup*/ 64) set_data_dev(t1, /*leftGroup*/ ctx[6]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(39:42) ",
    		ctx
    	});

    	return block;
    }

    // (35:42) 
    function create_if_block_6(ctx) {
    	let t0;
    	let a;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("has joined your group ");
    			a = element("a");
    			t1 = text(/*joinedGroup*/ ctx[5]);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "class", "notification__group svelte-1arijb9");
    			add_location(a, file$3, 35, 30, 1350);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*joinedGroup*/ 32) set_data_dev(t1, /*joinedGroup*/ ctx[5]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(35:42) ",
    		ctx
    	});

    	return block;
    }

    // (33:38) 
    function create_if_block_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("followed you");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(33:38) ",
    		ctx
    	});

    	return block;
    }

    // (31:39) 
    function create_if_block_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("commented on your picture");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(31:39) ",
    		ctx
    	});

    	return block;
    }

    // (28:6) {#if activity === 'react'}
    function create_if_block_3(ctx) {
    	let t0;
    	let a;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("reacted to your recent post\r\n        ");
    			a = element("a");
    			t1 = text(/*reactPost*/ ctx[3]);
    			attr_dev(a, "class", "notification__react-post svelte-1arijb9");
    			attr_dev(a, "href", "#");
    			add_location(a, file$3, 29, 8, 1076);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*reactPost*/ 8) set_data_dev(t1, /*reactPost*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(28:6) {#if activity === 'react'}",
    		ctx
    	});

    	return block;
    }

    // (45:6) {#if unread}
    function create_if_block_2(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "notification__unread svelte-1arijb9");
    			add_location(span, file$3, 45, 8, 1649);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(45:6) {#if unread}",
    		ctx
    	});

    	return block;
    }

    // (52:4) {#if privateMessage}
    function create_if_block_1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*privateMessage*/ ctx[7]);
    			attr_dev(p, "class", "notification__private-message svelte-1arijb9");
    			add_location(p, file$3, 52, 6, 1798);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*privateMessage*/ 128) set_data_dev(t, /*privateMessage*/ ctx[7]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(52:4) {#if privateMessage}",
    		ctx
    	});

    	return block;
    }

    // (57:2) {#if commentPicture}
    function create_if_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = /*commentPicture*/ ctx[4])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "commented");
    			add_location(img, file$3, 58, 6, 1963);
    			attr_dev(div, "class", "notification__comment-picture svelte-1arijb9");
    			add_location(div, file$3, 57, 4, 1912);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*commentPicture*/ 16 && !src_url_equal(img.src, img_src_value = /*commentPicture*/ ctx[4])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(57:2) {#if commentPicture}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let article;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let div1;
    	let p0;
    	let strong;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let p1;
    	let t6;
    	let t7;

    	function select_block_type(ctx, dirty) {
    		if (/*activity*/ ctx[1] === 'react') return create_if_block_3;
    		if (/*activity*/ ctx[1] === 'comment') return create_if_block_4;
    		if (/*activity*/ ctx[1] === 'follow') return create_if_block_5;
    		if (/*activity*/ ctx[1] === 'join-group') return create_if_block_6;
    		if (/*activity*/ ctx[1] === 'left-group') return create_if_block_7;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*unread*/ ctx[0] && create_if_block_2(ctx);
    	let if_block2 = /*privateMessage*/ ctx[7] && create_if_block_1(ctx);
    	let if_block3 = /*commentPicture*/ ctx[4] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			p0 = element("p");
    			strong = element("strong");
    			t1 = text(/*personName*/ ctx[2]);
    			t2 = space();
    			if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			t4 = space();
    			p1 = element("p");
    			p1.textContent = "2 weeks ago";
    			t6 = space();
    			if (if_block2) if_block2.c();
    			t7 = space();
    			if (if_block3) if_block3.c();
    			if (!src_url_equal(img.src, img_src_value = "images/avatar-" + toKebabCase(/*personName*/ ctx[2]) + ".webp")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$3, 20, 4, 796);
    			attr_dev(div0, "class", "notification__avatar svelte-1arijb9");
    			add_location(div0, file$3, 19, 2, 756);
    			attr_dev(strong, "class", "notification__person svelte-1arijb9");
    			add_location(strong, file$3, 25, 6, 935);
    			add_location(p0, file$3, 24, 4, 924);
    			attr_dev(p1, "class", "notification__date");
    			add_location(p1, file$3, 49, 4, 1717);
    			attr_dev(div1, "class", "notification__content svelte-1arijb9");
    			add_location(div1, file$3, 23, 2, 883);
    			attr_dev(article, "class", "notification svelte-1arijb9");
    			toggle_class(article, "notification--unread", /*unread*/ ctx[0]);
    			add_location(article, file$3, 18, 0, 686);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, div0);
    			append_dev(div0, img);
    			append_dev(article, t0);
    			append_dev(article, div1);
    			append_dev(div1, p0);
    			append_dev(p0, strong);
    			append_dev(strong, t1);
    			append_dev(p0, t2);
    			if_block0.m(p0, null);
    			append_dev(p0, t3);
    			if (if_block1) if_block1.m(p0, null);
    			append_dev(div1, t4);
    			append_dev(div1, p1);
    			append_dev(div1, t6);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(article, t7);
    			if (if_block3) if_block3.m(article, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*personName*/ 4 && !src_url_equal(img.src, img_src_value = "images/avatar-" + toKebabCase(/*personName*/ ctx[2]) + ".webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*personName*/ 4) set_data_dev(t1, /*personName*/ ctx[2]);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(p0, t3);
    				}
    			}

    			if (/*unread*/ ctx[0]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(p0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*privateMessage*/ ctx[7]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*commentPicture*/ ctx[4]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					if_block3.m(article, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty & /*unread*/ 1) {
    				toggle_class(article, "notification--unread", /*unread*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function toKebabCase(str) {
    	return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, ''); // Convert to lowercase
    	// Replace spaces with hyphens
    	// Remove any non-alphanumeric characters except hyphens
    	// Replace multiple consecutive hyphens with a single hyphen
    	// Remove hyphens from the beginning or end of the string
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Notification', slots, []);
    	let { unread } = $$props;
    	let { activity } = $$props;
    	let { personName } = $$props;
    	let { reactPost = '' } = $$props;
    	let { commentPicture = '' } = $$props;
    	let { joinedGroup = '' } = $$props;
    	let { leftGroup = '' } = $$props;
    	let { privateMessage = '' } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (unread === undefined && !('unread' in $$props || $$self.$$.bound[$$self.$$.props['unread']])) {
    			console.warn("<Notification> was created without expected prop 'unread'");
    		}

    		if (activity === undefined && !('activity' in $$props || $$self.$$.bound[$$self.$$.props['activity']])) {
    			console.warn("<Notification> was created without expected prop 'activity'");
    		}

    		if (personName === undefined && !('personName' in $$props || $$self.$$.bound[$$self.$$.props['personName']])) {
    			console.warn("<Notification> was created without expected prop 'personName'");
    		}
    	});

    	const writable_props = [
    		'unread',
    		'activity',
    		'personName',
    		'reactPost',
    		'commentPicture',
    		'joinedGroup',
    		'leftGroup',
    		'privateMessage'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Notification> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('unread' in $$props) $$invalidate(0, unread = $$props.unread);
    		if ('activity' in $$props) $$invalidate(1, activity = $$props.activity);
    		if ('personName' in $$props) $$invalidate(2, personName = $$props.personName);
    		if ('reactPost' in $$props) $$invalidate(3, reactPost = $$props.reactPost);
    		if ('commentPicture' in $$props) $$invalidate(4, commentPicture = $$props.commentPicture);
    		if ('joinedGroup' in $$props) $$invalidate(5, joinedGroup = $$props.joinedGroup);
    		if ('leftGroup' in $$props) $$invalidate(6, leftGroup = $$props.leftGroup);
    		if ('privateMessage' in $$props) $$invalidate(7, privateMessage = $$props.privateMessage);
    	};

    	$$self.$capture_state = () => ({
    		unread,
    		activity,
    		personName,
    		reactPost,
    		commentPicture,
    		joinedGroup,
    		leftGroup,
    		privateMessage,
    		toKebabCase
    	});

    	$$self.$inject_state = $$props => {
    		if ('unread' in $$props) $$invalidate(0, unread = $$props.unread);
    		if ('activity' in $$props) $$invalidate(1, activity = $$props.activity);
    		if ('personName' in $$props) $$invalidate(2, personName = $$props.personName);
    		if ('reactPost' in $$props) $$invalidate(3, reactPost = $$props.reactPost);
    		if ('commentPicture' in $$props) $$invalidate(4, commentPicture = $$props.commentPicture);
    		if ('joinedGroup' in $$props) $$invalidate(5, joinedGroup = $$props.joinedGroup);
    		if ('leftGroup' in $$props) $$invalidate(6, leftGroup = $$props.leftGroup);
    		if ('privateMessage' in $$props) $$invalidate(7, privateMessage = $$props.privateMessage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		unread,
    		activity,
    		personName,
    		reactPost,
    		commentPicture,
    		joinedGroup,
    		leftGroup,
    		privateMessage
    	];
    }

    class Notification extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			unread: 0,
    			activity: 1,
    			personName: 2,
    			reactPost: 3,
    			commentPicture: 4,
    			joinedGroup: 5,
    			leftGroup: 6,
    			privateMessage: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Notification",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get unread() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set unread(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activity() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activity(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get personName() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set personName(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get reactPost() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set reactPost(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get commentPicture() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set commentPicture(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get joinedGroup() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set joinedGroup(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get leftGroup() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set leftGroup(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get privateMessage() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set privateMessage(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Notifications\NotificationsHeader.svelte generated by Svelte v3.57.0 */

    const file$2 = "src\\Notifications\\NotificationsHeader.svelte";

    function create_fragment$2(ctx) {
    	let header;
    	let h1;
    	let t0;
    	let span;
    	let t1;
    	let t2;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			t0 = text("Notifications ");
    			span = element("span");
    			t1 = text(/*notificationsUnread*/ ctx[0]);
    			t2 = space();
    			button = element("button");
    			button.textContent = "Mark all as read";
    			attr_dev(span, "class", "notifications__count svelte-7yytrz");
    			add_location(span, file$2, 5, 18, 137);
    			attr_dev(h1, "class", "notifications svelte-7yytrz");
    			add_location(h1, file$2, 4, 2, 91);
    			attr_dev(button, "class", "mark-button svelte-7yytrz");
    			add_location(button, file$2, 8, 2, 219);
    			attr_dev(header, "class", "header svelte-7yytrz");
    			add_location(header, file$2, 3, 0, 64);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(h1, span);
    			append_dev(span, t1);
    			append_dev(header, t2);
    			append_dev(header, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[1], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*notificationsUnread*/ 1) set_data_dev(t1, /*notificationsUnread*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NotificationsHeader', slots, []);
    	let { notificationsUnread } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (notificationsUnread === undefined && !('notificationsUnread' in $$props || $$self.$$.bound[$$self.$$.props['notificationsUnread']])) {
    			console.warn("<NotificationsHeader> was created without expected prop 'notificationsUnread'");
    		}
    	});

    	const writable_props = ['notificationsUnread'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NotificationsHeader> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('notificationsUnread' in $$props) $$invalidate(0, notificationsUnread = $$props.notificationsUnread);
    	};

    	$$self.$capture_state = () => ({ notificationsUnread });

    	$$self.$inject_state = $$props => {
    		if ('notificationsUnread' in $$props) $$invalidate(0, notificationsUnread = $$props.notificationsUnread);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [notificationsUnread, click_handler];
    }

    class NotificationsHeader extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { notificationsUnread: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotificationsHeader",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get notificationsUnread() {
    		throw new Error("<NotificationsHeader>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set notificationsUnread(value) {
    		throw new Error("<NotificationsHeader>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\UI\Container.svelte generated by Svelte v3.57.0 */

    const file$1 = "src\\UI\\Container.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "container svelte-1u3hbyn");
    			add_location(div, file$1, 2, 0, 31);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Container', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Container> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Container extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Container",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.57.0 */

    const { Object: Object_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (71:4) {#each notifications as notification (generateUniqueId())}
    function create_each_block(key_1, ctx) {
    	let first;
    	let notification;
    	let current;
    	const notification_spread_levels = [/*notification*/ ctx[3]];
    	let notification_props = {};

    	for (let i = 0; i < notification_spread_levels.length; i += 1) {
    		notification_props = assign(notification_props, notification_spread_levels[i]);
    	}

    	notification = new Notification({
    			props: notification_props,
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(notification.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(notification, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			const notification_changes = (dirty & /*notifications*/ 1)
    			? get_spread_update(notification_spread_levels, [get_spread_object(/*notification*/ ctx[3])])
    			: {};

    			notification.$set(notification_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(notification.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(notification.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(notification, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(71:4) {#each notifications as notification (generateUniqueId())}",
    		ctx
    	});

    	return block;
    }

    // (64:0) <Container>
    function create_default_slot(ctx) {
    	let notificationsheader;
    	let t;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;

    	notificationsheader = new NotificationsHeader({
    			props: {
    				notificationsUnread: /*notificationsUnread*/ ctx[1]
    			},
    			$$inline: true
    		});

    	notificationsheader.$on("click", /*markNotificationsAsRead*/ ctx[2]);
    	let each_value = /*notifications*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => generateUniqueId();
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key();
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			create_component(notificationsheader.$$.fragment);
    			t = space();
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(main, file, 69, 2, 2249);
    		},
    		m: function mount(target, anchor) {
    			mount_component(notificationsheader, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, main, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(main, null);
    				}
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const notificationsheader_changes = {};
    			if (dirty & /*notificationsUnread*/ 2) notificationsheader_changes.notificationsUnread = /*notificationsUnread*/ ctx[1];
    			notificationsheader.$set(notificationsheader_changes);

    			if (dirty & /*notifications*/ 1) {
    				each_value = /*notifications*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(notificationsheader.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(notificationsheader.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(notificationsheader, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(64:0) <Container>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let container;
    	let current;

    	container = new Container({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(container.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(container, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const container_changes = {};

    			if (dirty & /*$$scope, notifications, notificationsUnread*/ 67) {
    				container_changes.$$scope = { dirty, ctx };
    			}

    			container.$set(container_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(container.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(container.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(container, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function generateUniqueId() {
    	let timestamp = Date.now().toString(36); // Convert current timestamp to base 36 string
    	let randomNum = Math.random().toString(36).substr(2, 5); // Generate random number and convert to base 36 string
    	return `${timestamp}-${randomNum}`;
    }

    function instance($$self, $$props, $$invalidate) {
    	let notificationsUnread;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	let notifications = [
    		{
    			activity: 'react',
    			personName: 'Mark Webber',
    			reactPost: 'My first tournament today!',
    			unread: true
    		},
    		{
    			activity: 'follow',
    			personName: 'Angela Gray',
    			unread: true
    		},
    		{
    			activity: 'join-group',
    			personName: 'Jacob Thompson',
    			joinedGroup: 'Chess Club',
    			unread: true
    		},
    		{
    			activity: 'private-message',
    			personName: 'Rizky Hasanuddin',
    			privateMessage: "Hello, thanks for setting up the Chess Club. I've been a member for a few weeks now and I'm already having lots of fun and improving my game.",
    			unread: false
    		},
    		{
    			activity: 'comment',
    			personName: 'Kimberly Smith',
    			commentPicture: 'images/image-chess.webp',
    			unread: false
    		},
    		{
    			activity: 'react',
    			personName: 'Nathan Peterson',
    			reactPost: '5 end-game strategies to increase your win rate',
    			unread: false
    		},
    		{
    			activity: 'left-group',
    			personName: 'Anna Kim',
    			leftGroup: 'Chess Club',
    			unread: false
    		}
    	];

    	function markNotificationsAsRead() {
    		const areNotificationsUnread = notifications.some(notification => notification.unread);

    		if (!areNotificationsUnread) {
    			return;
    		}

    		$$invalidate(0, notifications = notifications.map(notification => {
    			return Object.assign(Object.assign({}, notification), { unread: false });
    		}));
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Notification,
    		NotificationsHeader,
    		Container,
    		notifications,
    		generateUniqueId,
    		markNotificationsAsRead,
    		notificationsUnread
    	});

    	$$self.$inject_state = $$props => {
    		if ('notifications' in $$props) $$invalidate(0, notifications = $$props.notifications);
    		if ('notificationsUnread' in $$props) $$invalidate(1, notificationsUnread = $$props.notificationsUnread);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*notifications*/ 1) {
    			$$invalidate(1, notificationsUnread = notifications.filter(notification => notification.unread).length);
    		}
    	};

    	return [notifications, notificationsUnread, markNotificationsAsRead];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
