;(() => {
    'use strict';

    window.promise = promise;

    function promise(callback) {
        const stack = {
            resolved: new Set(),
            rejected: new Set()
        }

        const state = {
            value: {
                resolved: undefined,
                rejected: undefined,
            },
            status: {
                current: 'pending',
                isPending() {
                    return this.current === "pending";
                },
                setResolved() {
                    this.current = "resolved";
                },
                setRejected() {
                    this.current = "rejected";
                }
            }
        };

        const toPromise = (value) => {
            if (typeof value === 'object' && value.then && value.catch) {
                return value;
            }

            return promise.resolve(value);
        }

        const asyncPipe = (...funcs) => {
            if (!funcs.length) {
                return (value) => value;
            }

            if (funcs.length === 1) {
                return funcs[0];
            }

            return funcs.reduce((a, b) => (...value) => toPromise(a(...value)).then(b));
        };

        let resolve = (value) => {
            state.value.resolved = asyncPipe(...stack.resolved)(value);
            stack.resolved.clear();
            state.status.setResolved();
            resolve = () => { };
            reject = () => { };
        };

        let reject = (value) => {
            state.value.rejected = asyncPipe(...stack.rejected)(value);
            stack.rejected.clear();
            state.status.setRejected();
            resolve = () => { };
            reject = () => { };
        };

        const api = {
            then(fn) {
                if (state.status.isPending()) {
                    stack.resolved.add(fn);
                } else {
                    state.value.resolved = fn(state.value.resolved);
                }
                return api;
            },
            catch(fn) {
                if (state.status.isPending()) {
                    stack.rejected.add(fn);
                } else {
                    state.value.rejected = fn(state.value.rejected);
                }
                return api;
            },
        };

        if (callback) {
            setTimeout(() => {
                try {
                    callback(resolve, reject);
                } catch (error) {
                    if (stack.rejected.size) {
                        reject(error);
                    } else {
                        throw error;
                    }
                }
            }, 0);
        } else {
            api.resolve = resolve;
            api.reject = reject;
        }

        return api;
    }

    promise.resolve = (value) => promise((resolve) => resolve(value));

    promise.reject = (error) => promise((_, reject) => reject(error));

    promise.all = (...promises) => promise((resolve, reject) => {
        const state = {
            counter: 0,
            data: []
        };

        promises.forEach((p, i) => {
            p.then((data) => {
                state.counter++;
                state.data[i] = data;

                if (state.counter === promises.length) {
                    resolve(state.data);
                }

                return data;
            }).catch((error) => {
                reject(error);
                return error;
            });
        });
    });

    promise.race = (...promises) => promise((resolve, reject) => {
        promises.forEach((item) => {
            item.then((data) => {
                resolve(data);
                return data;
            }).catch((error) => {
                reject(error);
                return error;
            });
        });
    });

    promise.queue = (items, callback) => promise((resolve, reject) => {
        const data = [];
        (function next(i) {
            const item = callback(items[i], i, items);

            if (!item) {
                return;
            }

            item.then((payload) => {
                data[i] = payload;
                items[i + 1] ? next(i + 1) : resolve(data);
                return payload;
            }).catch(reject);
        })(0);
    });

    promise.parallel = (items, callback) => {
        const promises = [];

        items.forEach((item, i) => {
            const result = callback(item, i, items);

            if (!result) {
                return;
            }

            promises.push(result);
        });

        return promise.all(...promises);
    }

    promise.delay = (ms) => promise((resolve) => setTimeout(() => resolve(), ms));

})();
