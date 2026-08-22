function getElementPosition(el) {
    const docEl = document.documentElement;
    const docRect = docEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
        x: elRect.left - docRect.left,
        y: elRect.top - docRect.top
    };
}

function getElement(to) {
    // Decode the hash so percent-encoded anchors (e.g. inline [text](#foo) links
    // to non-ASCII headings, which markdown-it encodes) match the heading's raw
    // slug id. The "#" header anchors are already raw, so decoding is a no-op.
    let targetAnchor = to.hash.slice(1);

    try {
        targetAnchor = decodeURIComponent(targetAnchor);
    } catch (error) {
        // Keep the raw anchor if it is not valid percent-encoding
    }
    return document.getElementById(targetAnchor) || document.querySelector(`[name='${targetAnchor}']`);
}

function scrollToAnchor(to) {
    const targetElement = getElement(to);

    if (targetElement) {
        return window.scrollTo({
            top: getElementPosition(targetElement).y,
            behavior: 'smooth'
        });
    }
}

export default ({
    Vue,
    router
}) => {
    // Workaround of vuepress #1499
    router.options.scrollBehavior = (to, from, savedPosition) => {
        if (savedPosition) {
            return window.scrollTo({
                top: savedPosition.y,
                behavior: 'smooth'
            });
        } else if (to.hash) {
            if (Vue.$vuepress.$get('disableScrollBehavior')) {
                return false;
            }
            new Promise((resolve, reject) => {
                if (getElement(to)) {
                    resolve();
                } else {
                    const timeout = Date.now() + 10000;
                    const timer = window.setInterval(() => {
                        if (getElement(to)) {
                            resolve();
                            window.clearInterval(timer);
                        } else if (Date.now() > timeout) {
                            window.clearInterval(timer);
                            reject(new Error('Timeout'));
                        }
                    }, 100);
                }
            }).then(() => {
                const promises = [];
                document.querySelectorAll('img').forEach(image => {
                    if (!image.complete) {
                        promises.push(new Promise(resolve => {
                            image.onload = resolve;
                        }));
                    }
                });
                Promise.all(promises).then(() => {
                    scrollToAnchor(to);
                });
            });
        } else {
            return window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    };

    // Route in-page hash links (the heading "#" anchors and plain [text](#foo)
    // links) through vue-router instead of letting the browser navigate them
    // natively. A native hash click does not update the router's route, so
    // @vuepress/plugin-active-header-links sees a stale route.hash and, on the
    // next scroll, replaces the URL back to the heading at the current position
    // (the "hash reverts and does not scroll" issue seen in Chrome). Going
    // through the router keeps route.hash in sync and reuses scrollBehavior.
    if (typeof window !== 'undefined') {
        window.addEventListener('click', event => {
            if (event.defaultPrevented || event.button !== 0 ||
                event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            const link = event.target.closest && event.target.closest('a[href]');

            if (!link || (link.target && link.target !== '_self')) {
                return;
            }

            const hash = link.getAttribute('href');

            if (!hash || hash.charAt(0) !== '#' || hash.length < 2) {
                return;
            }

            event.preventDefault();
            if (router.currentRoute.hash === hash) {
                scrollToAnchor({hash});
            } else {
                router.push({hash}).catch(() => { /* ignore duplicated navigation */ });
            }
        });
    }
};
