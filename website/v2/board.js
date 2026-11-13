import { API } from '../api.js';
import { SETTINGS } from './config.js';

const board = document.querySelector('#board');
const photoLayer = document.querySelector('#board-photos');
const logoBoundsElement = document.querySelector('#board-logo-bounds');
const photos = new Map();

document.documentElement.style.setProperty('--qr-scale', SETTINGS.qrScale);
document.documentElement.style.setProperty('--logo-scale', SETTINGS.logoScale);

function randomAround(average, variation) {
    return average + (Math.random() * 2 - 1) * variation;
}

function createPlacement() {
    return {
        x: Math.random(),
        y: Math.random(),
        size: randomAround(1, SETTINGS.sizeVariation),
        angle: randomAround(SETTINGS.averageRotation, SETTINGS.rotationVariation),
    };
}

function fitPositionToRegions(position, regions) {
    let closest;
    let shortestDistance = Infinity;
    for (const region of regions) {
        const x = Math.max(region.left, Math.min(region.right, position.x));
        const y = Math.max(region.top, Math.min(region.bottom, position.y));
        const distance = (x - position.x) ** 2 + (y - position.y) ** 2;
        if (distance < shortestDistance) {
            shortestDistance = distance;
            closest = { x, y };
        }
    }
    return closest;
}

function rectangleArea(rectangle) {
    return (rectangle.right - rectangle.left) * (rectangle.bottom - rectangle.top);
}

function subtractRectangle(region, obstacle) {
    const left = Math.max(region.left, obstacle.left);
    const right = Math.min(region.right, obstacle.right);
    const top = Math.max(region.top, obstacle.top);
    const bottom = Math.min(region.bottom, obstacle.bottom);
    if (left >= right || top >= bottom) return [region];

    return [
        { left: region.left, right: left, top: region.top, bottom: region.bottom },
        { left: right, right: region.right, top: region.top, bottom: region.bottom },
        { left, right, top: region.top, bottom: top },
        { left, right, top: bottom, bottom: region.bottom },
    ].filter(part => part.right > part.left && part.bottom > part.top);
}

function randomPositionNear(position, regions, halfWidth, halfHeight) {
    const nearbyRegions = regions.map(region => ({
        left: Math.max(region.left, position.x - halfWidth),
        right: Math.min(region.right, position.x + halfWidth),
        top: Math.max(region.top, position.y - halfHeight),
        bottom: Math.min(region.bottom, position.y + halfHeight),
    })).filter(region => region.right > region.left && region.bottom > region.top);

    let selection = Math.random() * nearbyRegions.reduce((sum, region) => sum + rectangleArea(region), 0);
    let index = 0;
    while (index < nearbyRegions.length - 1 && selection >= rectangleArea(nearbyRegions[index])) {
        selection -= rectangleArea(nearbyRegions[index]);
        index += 1;
    }
    const region = nearbyRegions[index];
    return {
        x: region.left + Math.random() * (region.right - region.left),
        y: region.top + Math.random() * (region.bottom - region.top),
    };
}

function findLeastOccupiedPosition(regions, neighbors, halfWidth, halfHeight) {
    let freeRegions = regions;
    for (const neighbor of neighbors) {
        const obstacle = {
            left: neighbor.left - halfWidth,
            right: neighbor.right + halfWidth,
            top: neighbor.top - halfHeight,
            bottom: neighbor.bottom + halfHeight,
        };
        freeRegions = freeRegions.flatMap(region => subtractRectangle(region, obstacle));
        if (freeRegions.length === 0) break;
    }

    if (freeRegions.length > 0) {
        const largest = freeRegions.reduce((best, region) =>
            rectangleArea(region) > rectangleArea(best) ? region : best);
        const center = { x: (largest.left + largest.right) / 2, y: (largest.top + largest.bottom) / 2 };
        return randomPositionNear(center, [largest], halfWidth, halfHeight);
    }

    let bestPosition;
    let leastOverlap = Infinity;
    for (const region of regions) {
        const horizontalSteps = Math.max(1, Math.ceil((region.right - region.left) / SETTINGS.placementSearchStep));
        const verticalSteps = Math.max(1, Math.ceil((region.bottom - region.top) / SETTINGS.placementSearchStep));
        for (let horizontal = 0; horizontal <= horizontalSteps; horizontal++) {
            const x = region.left + (region.right - region.left) * horizontal / horizontalSteps;
            for (let vertical = 0; vertical <= verticalSteps; vertical++) {
                const y = region.top + (region.bottom - region.top) * vertical / verticalSteps;
                const visibleLeft = Math.max(0, x - halfWidth);
                const visibleRight = Math.min(board.clientWidth, x + halfWidth);
                const visibleTop = Math.max(0, y - halfHeight);
                const visibleBottom = Math.min(board.clientHeight, y + halfHeight);
                let overlap = 0;
                for (const neighbor of neighbors) {
                    const overlapWidth = Math.max(0,
                        Math.min(visibleRight, neighbor.right) - Math.max(visibleLeft, neighbor.left));
                    const overlapHeight = Math.max(0,
                        Math.min(visibleBottom, neighbor.bottom) - Math.max(visibleTop, neighbor.top));
                    overlap += overlapWidth * overlapHeight;
                }
                overlap /= (visibleRight - visibleLeft) * (visibleBottom - visibleTop);
                if (overlap < leastOverlap) {
                    leastOverlap = overlap;
                    bestPosition = { x, y };
                }
            }
        }
    }
    return randomPositionNear(bestPosition, regions, halfWidth, halfHeight);
}

function placePhoto(entry, choosePosition = false) {
    const { element, placement } = entry;
    const width = board.clientWidth;
    const height = board.clientHeight;
    const averageWidth = Math.min(SETTINGS.averagePhotoWidth, width * 0.28);
    const image = element.querySelector('img');
    const frameWidth = element.offsetWidth - element.clientWidth;
    const maximumHeight = Math.min(SETTINGS.maxPhotoHeight, height * 0.42) / entry.scale;
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    const heightLimitedWidth = (maximumHeight - frameWidth) * aspectRatio + frameWidth;
    element.style.width = `${Math.min(averageWidth * placement.size, heightLimitedWidth)}px`;

    const radians = Math.abs(placement.angle) * Math.PI / 180;
    const rotatedWidth = (element.offsetWidth * Math.cos(radians) + element.offsetHeight * Math.sin(radians)) * entry.scale;
    const rotatedHeight = (element.offsetHeight * Math.cos(radians) + element.offsetWidth * Math.sin(radians)) * entry.scale;
    const allowedOverflow = element.offsetWidth * entry.scale * SETTINGS.edgeOverflowRatio;
    const minimumX = rotatedWidth / 2 - allowedOverflow;
    const minimumY = rotatedHeight / 2 - allowedOverflow;
    const maximumX = width - minimumX;
    const maximumY = height - minimumY;

    const logoBounds = logoBoundsElement.getBoundingClientRect();
    photoLayer.style.clipPath = `polygon(evenodd,
        0px 0px, ${width}px 0px, ${width}px ${height}px, 0px ${height}px, 0px 0px,
        ${logoBounds.left}px ${logoBounds.top}px,
        ${logoBounds.right}px ${logoBounds.top}px,
        ${logoBounds.right}px ${logoBounds.bottom}px,
        ${logoBounds.left}px ${logoBounds.bottom}px,
        ${logoBounds.left}px ${logoBounds.top}px)`;
    // Include the photo shadow when protecting the marked area.
    const shadowMargin = 16;
    const left = logoBounds.left - rotatedWidth / 2 - shadowMargin;
    const right = logoBounds.right + rotatedWidth / 2 + shadowMargin;
    const top = logoBounds.top - rotatedHeight / 2 - shadowMargin;
    const bottom = logoBounds.bottom + rotatedHeight / 2 + shadowMargin;

    const middleLeft = Math.max(minimumX, left);
    const middleRight = Math.min(maximumX, right);
    const regions = [
        { left: minimumX, right: Math.min(maximumX, left), top: minimumY, bottom: maximumY },
        { left: Math.max(minimumX, right), right: maximumX, top: minimumY, bottom: maximumY },
        { left: middleLeft, right: middleRight, top: minimumY, bottom: Math.min(maximumY, top) },
        { left: middleLeft, right: middleRight, top: Math.max(minimumY, bottom), bottom: maximumY },
    ].filter(region => region.right > region.left && region.bottom > region.top);

    // A large zoom can leave no room outside the logo.
    if (regions.length === 0) {
        element.hidden = true;
        return;
    }

    let position = fitPositionToRegions({ x: placement.x * width, y: placement.y * height }, regions);
    if (choosePosition) {
        const neighbors = [...photos.values()]
            .filter(photo => photo !== entry && !photo.element.hidden)
            .map(photo => photo.bounds);
        position = findLeastOccupiedPosition(regions, neighbors, rotatedWidth / 2, rotatedHeight / 2);

        placement.x = position.x / width;
        placement.y = position.y / height;
    }

    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.style.transform = `translate(-50%, -50%) rotate(${placement.angle}deg) scale(${entry.scale})`;
    entry.bounds = {
        left: position.x - rotatedWidth / 2,
        right: position.x + rotatedWidth / 2,
        top: position.y - rotatedHeight / 2,
        bottom: position.y + rotatedHeight / 2,
    };
}

function addPhoto(picture) {
    const element = document.createElement('figure');
    element.className = 'board-photo';
    element.hidden = true;
    const image = document.createElement('img');
    image.alt = 'Фотография';
    element.append(image);

    const entry = {
        element,
        placement: createPlacement(),
        scale: SETTINGS.photoScale * (SETTINGS.photoScales[picture.id] ?? 1),
    };
    photos.set(picture.id, entry);
    photoLayer.append(element);

    image.onload = () => {
        element.hidden = false;
        placePhoto(entry, true);
        element.animate([
            { opacity: 0, transform: `${element.style.transform} scale(2)` },
            { opacity: 1, transform: element.style.transform },
        ], {
            duration: SETTINGS.appearanceDuration,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        });
    };
    image.src = API.getImageUrl(picture.id);
}

function reconcile(pictures) {
    const activeIds = new Set(pictures.map(picture => picture.id));
    for (const [id, entry] of photos) {
        if (!activeIds.has(id)) {
            entry.element.remove();
            photos.delete(id);
        }
    }

    pictures.forEach((picture, index) => {
        if (!photos.has(picture.id)) {
            addPhoto(picture);
        }
        const entry = photos.get(picture.id);
        const newerCount = pictures.length - index - 1;
        const dimmingAge = Math.max(0, newerCount - SETTINGS.fullBrightnessCount + 1);
        const brightness = Math.max(
            SETTINGS.minimumBrightness,
            1 - Math.log1p(dimmingAge) * SETTINGS.dimmingRate,
        );
        entry.element.style.zIndex = index + 1;
        entry.element.style.filter = `brightness(${brightness})`;
    });
}

async function refreshPhotos() {
    try {
        const pictures = await API.getConfig({ allPictures: true });
        pictures.sort((first, second) => {
            const firstDate = new Date(first.accepted_at || first.created_at);
            const secondDate = new Date(second.accepted_at || second.created_at);
            return firstDate - secondDate || first.id - second.id;
        });
        reconcile(pictures);
    } catch (error) {
        console.error('Failed to refresh photo board:', error);
    } finally {
        setTimeout(refreshPhotos, SETTINGS.refreshInterval);
    }
}

refreshPhotos();

window.addEventListener('resize', () => {
    for (const entry of photos.values()) {
        if (entry.element.querySelector('img').naturalWidth) {
            entry.element.hidden = false;
            placePhoto(entry);
        }
    }
});

