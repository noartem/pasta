// Keyboard navigation for the pasta lists (/all and /{slug}/versions). The selected item is
// the one whose link has focus, so Enter opens it natively.

function isTyping(target) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}

document.addEventListener("DOMContentLoaded", () => {
    const links = [...document.querySelectorAll("[data-list-item] [data-list-link]")];
    const search = document.getElementById("search");

    const selectedIndex = () => links.indexOf(document.activeElement);
    // These return whether they did anything, so keys keep their default action otherwise.
    const select = (index) => {
        const link = links[Math.max(0, Math.min(index, links.length - 1))];
        if (!link) return false;
        link.focus({ preventScroll: true });
        link.closest("[data-list-item]").scrollIntoView({ block: "nearest" });
        return true;
    };
    // Without a selection, moving starts from the current version (versions page) or the top.
    const move = (step) => {
        const index = selectedIndex();
        if (index !== -1) {
            return select(index + step);
        }
        const current = document.querySelector("[data-list-item][data-current] [data-list-link]");
        return select(current ? links.indexOf(current) : step > 0 ? 0 : links.length - 1);
    };
    const follow = (id) => {
        const link = document.getElementById(id);
        if (!link) return false;
        window.location.href = link.href;
        return true;
    };

    document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

        if (isTyping(event.target)) {
            if (event.target !== search || event.altKey || event.shiftKey) return;
            if (event.key === "Escape") {
                search.blur();
            } else if (event.key !== "ArrowDown" || !select(0)) {
                return;
            }
            event.preventDefault();
            return;
        }

        if (event.altKey) {
            const link = links[selectedIndex()];
            if (event.key !== "Enter" || !link) return;
            window.open(link.href, "_blank", "noopener");
            event.preventDefault();
            return;
        }

        const actions = {
            ArrowDown: () => move(1),
            j: () => move(1),
            ArrowUp: () => move(-1),
            k: () => move(-1),
            Home: () => select(0),
            End: () => select(links.length - 1),
            o: () => {
                const link = links[selectedIndex()];
                link?.click();
                return Boolean(link);
            },
            ArrowLeft: () => follow("prev-page"),
            ArrowRight: () => follow("next-page"),
            "/": () => {
                search?.focus();
                search?.select();
                return Boolean(search);
            },
            n: () => {
                window.location.href = "/";
                return true;
            },
        };
        if (Object.hasOwn(actions, event.key) && actions[event.key]()) {
            event.preventDefault();
        }
    });
});
