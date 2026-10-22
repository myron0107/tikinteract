// Normalize the two historical defaults to the current, already-rendered shell.
// Custom layouts published from administration retain their configured order.
export function studioPanelLayout(layout) {
    const signature = layout.left.join(',') + '|' + layout.right.join(',');
    if (['games,controls|streamer,audio,stats,feed', 'games,audio,streamer|controls,stats,feed'].includes(signature)) {
        return {left: ['games', 'audio'], right: ['controls', 'streamer', 'stats', 'feed']};
    }
    return layout;
}

export function arrangeStudioPanels(layout, hosts, panels) {
    for (const side of ['left', 'right']) {
        const host = hosts[side];
        const desired = studioPanelLayout(layout)[side].map(id => panels[id]).filter(Boolean);
        const current = [...host.children].filter(node => desired.includes(node));
        if (desired.every((node, index) => node.parentElement === host && current[index] === node)) continue;
        for (const node of desired) host.append(node);
    }
}
