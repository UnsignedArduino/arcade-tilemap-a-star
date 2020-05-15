namespace scene {
    const PATH_FOLLOW_KEY = "A_STAR_PATH_FOLLOW";

    class PathFollowingSprite {
        public index: number;
        public onEndHandler: () => void;

        constructor (
            public sprite: Sprite,
            public path: tiles.Location[],
            public speed: number
        ) {
            this.index = 0;
        }
    }

    function init() {
        if (!game.currentScene().data[PATH_FOLLOW_KEY]) {
            game.currentScene().data[PATH_FOLLOW_KEY] = [] as PathFollowingSprite[];

            game.onUpdate(function () {
                const store: PathFollowingSprite[] = game.currentScene().data[PATH_FOLLOW_KEY];
                const toRemove: PathFollowingSprite[] = [];

                for (const pfs of store) {
                    const { sprite, index, path, speed } = pfs;
                    const target = path[index];

                    const { x, y, vx, vy } = sprite;
                    const pastTargetHorizontally = !vx || (vx < 0 && x <= target.x) || (vx > 0 && x >= target.x);
                    const pastTargetVertically = !vy || (vy < 0 && y <= target.y) || (vy > 0 && y >= target.y);

                    if (pastTargetVertically && pastTargetHorizontally) {
                        // target next index
                        pfs.index++;
                        const newTarget = path[pfs.index];
                        if (!newTarget) {
                            sprite.setVelocity(0, 0);
                            target.place(sprite);
                            toRemove.push(pfs);
                            if (pfs.onEndHandler) {
                                pfs.onEndHandler();
                            }
                        } else {
                            target.place(sprite);

                            const angle = Math.atan2(
                                newTarget.y - y,
                                newTarget.x - x
                            );

                            sprite.setVelocity(
                                Math.cos(angle) * speed,
                                Math.sin(angle) * speed
                            );
                        }
                    }
                }

                for (const el of toRemove) {
                    store.removeElement(el);
                }
            });
        }
    }

    // TODO: probably should have logic to bail when a tile that wasn't a wall
    //      is set to be a wall. Or just use velocity, and let enemy run into wall 
    // TODO: maybe logic for if path === previous path, or if we want to be fancy
    //      path  === remainder of previous path. that might be nice for if we recalculate
    //      optimal path mid path;if it's the same do nothing, otherwise start movement
    // TODO: maybe something better than just placing on tile when sprite position
    //      is not he same as tile position

    /**
     * @param sprite sprite to give a path to
     * @param path path to follow
     * @param speed speed at which to follow path eg: 50
     */
    //% block="sprite $sprite follow path $path || speed %speed"
    //% sprite.shadow="variables_get"
    //% sprite.defl="mySprite"
    //% path.shadow="variables_get"
    //% path.defl="locationTiles"
    //% group="Tiles" weight=9
    export function followPath(sprite: Sprite, path: tiles.Location[], speed?: number) {
        if (!path || !path.length)
            return;

        if (!speed)
            speed = 50;

        // if we're on the path already, just follow the subset of the remaining path
        let remainingPath = getRemainingPath(sprite, path);
        if (remainingPath) {
            _followPath(sprite, remainingPath, speed);
            return;
        }

        // otherwise, path with a-star (no heuristic) to the path
        const currentLocation = locationOfSprite(sprite)
        const tm = game.currentScene().tileMap;
        const pathToNearest = generalAStar(tm, currentLocation, () => 0, tile => {
            for (let pathTile of path) {
                if (tile.x === pathTile.x && tile.y === pathTile.y) {
                    return true;
                }
            }
            return false;
        });
        _followPath(sprite, pathToNearest, speed, () => {
            // then follow the remaining of the path
            control.runInParallel(function () {
                let remainingPath = getRemainingPath(sprite, path);
                 _followPath(sprite, remainingPath, speed);
            })
        })
    }

    export function teleportToAndFollowPath(sprite: Sprite, path: tiles.Location[], speed?: number) {
        _followPath(sprite, path, speed);
    }

    export function _followPath(sprite: Sprite, path: tiles.Location[], speed?: number, endCb?: () => void) {
        if (!sprite)
            return;

        init();
        const store = game.currentScene().data[PATH_FOLLOW_KEY] as PathFollowingSprite[];
        const previousEl = store.find(el => el.sprite === sprite);

        if (previousEl) {
            if (speed) {
                previousEl.speed = speed;
            }

            const start = path && path[0];
            if (!start) {
                store.removeElement(previousEl);
                return;
            }

            start.place(sprite);
            previousEl.path = path;
            previousEl.index = 0;

            if (previousEl.onEndHandler)
                previousEl.onEndHandler = endCb;
        } else if (path) {
            const start = path[0];

            if (start) {
                sprite.setVelocity(0, 0);
                const pfs = new PathFollowingSprite(
                    sprite,
                    path,
                    speed || 50
                );
                pfs.onEndHandler = endCb;
                store.push(pfs);
                start.place(sprite);
            }
        }
    }


    /**
     * Returns the index in the path which is closest to the current sprite by direct distance
     */
    export function getNearestPathIdx(sprite: Sprite, path: tiles.Location[]): number {
        let minDistSqrd = 99999
        let idx = 0;
        for (let i = 0; i < path.length; i++) {
            let t = path[i];
            let distSqrd = (sprite.x - t.x)**2 + (sprite.y - t.y)**2;
            if (distSqrd < minDistSqrd) {
                minDistSqrd = distSqrd;
                idx = i;
            }
        }
        return idx
    }

    // TODO: this really needs to be in common packages...
    // copy-pasta from pxt-tilemaps
    function screenCoordinateToTile(value: number) {
        const tm = game.currentScene().tileMap;
        if (!tm) return value >> 4;
        return value >> tm.scale;
    }

    function locationOfSprite(s: Sprite): tiles.Location {
        return tiles.getTileLocation(screenCoordinateToTile(s.x), screenCoordinateToTile(s.y));
    }

    function getRemainingPath(sprite: Sprite, path: tiles.Location[]): tiles.Location[] | null {
        const currentLocation = locationOfSprite(sprite)
        for (let i = 0; i < path.length; i++) {
            const pathTile = path[i];
            if (currentLocation.x === pathTile.x && currentLocation.y === pathTile.y) {
                const remainingPath = i === 0 ? path : path.filter((_, j) => j >= i);
                return remainingPath;
            }
        }
        return null
    }
}