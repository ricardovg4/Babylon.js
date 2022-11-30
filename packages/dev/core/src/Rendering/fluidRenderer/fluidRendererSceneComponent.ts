import type { Camera } from "core/Cameras/camera";
import type { RenderTargetTexture } from "core/Materials/Textures/renderTargetTexture";
import type { SmartArrayNoDuplicate } from "core/Misc/smartArray";
import { Scene } from "core/scene";
import type { ISceneComponent } from "core/sceneComponent";
import { SceneComponentConstants } from "core/sceneComponent";
import type { Nullable } from "core/types";

import { FluidRenderer } from "./fluidRenderer";

declare module "core/abstractScene" {
    export interface AbstractScene {
        /** @internal (Backing field) */
        _fluidRenderer: Nullable<FluidRenderer>;

        /**
         * Gets or Sets the fluid renderer associated to the scene.
         */
        fluidRenderer: Nullable<FluidRenderer>;

        /**
         * Enables the fluid renderer and associates it with the scene
         * @returns the FluidRenderer
         */
        enableFluidRenderer(): Nullable<FluidRenderer>;

        /**
         * Disables the fluid renderer associated with the scene
         */
        disableFluidRenderer(): void;
    }
}

Object.defineProperty(Scene.prototype, "fluidRenderer", {
    get: function (this: Scene) {
        return this._fluidRenderer;
    },
    set: function (this: Scene, value: Nullable<FluidRenderer>) {
        this._fluidRenderer = value;
    },
    enumerable: true,
    configurable: true,
});

Scene.prototype.enableFluidRenderer = function (): Nullable<FluidRenderer> {
    if (this._fluidRenderer) {
        return this._fluidRenderer;
    }

    this._fluidRenderer = new FluidRenderer(this);

    return this._fluidRenderer;
};

Scene.prototype.disableFluidRenderer = function (): void {
    this._fluidRenderer?.dispose();
    this._fluidRenderer = null;
};

/**
 * Defines the fluid renderer scene component responsible to render objects as fluids
 */
export class FluidRendererSceneComponent implements ISceneComponent {
    /**
     * The component name helpful to identify the component in the list of scene components.
     */
    public readonly name = SceneComponentConstants.NAME_FLUIDRENDERER;

    /**
     * The scene the component belongs to.
     */
    public scene: Scene;

    /**
     * Creates a new instance of the component for the given scene
     * @param scene Defines the scene to register the component in
     */
    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Registers the component in a given scene
     */
    public register(): void {
        this.scene._gatherActiveCameraRenderTargetsStage.registerStep(
            SceneComponentConstants.STEP_GATHERACTIVECAMERARENDERTARGETS_FLUIDRENDERER,
            this,
            this._gatherActiveCameraRenderTargets
        );
        this.scene._afterCameraDrawStage.registerStep(SceneComponentConstants.STEP_AFTERCAMERADRAW_FLUIDRENDERER, this, this._afterCameraDraw);
    }

    private _gatherActiveCameraRenderTargets(_renderTargets: SmartArrayNoDuplicate<RenderTargetTexture>): void {
        this.scene.fluidRenderer?._prepareRendering();
    }

    private _afterCameraDraw(camera: Camera) {
        this.scene.fluidRenderer?._render(camera);
    }

    /**
     * Rebuilds the elements related to this component in case of
     * context lost for instance.
     */
    public rebuild(): void {
        if (this.scene._fluidRenderer) {
            // Release resources first
            this.scene.disableFluidRenderer();

            // Re-enable
            this.scene.enableFluidRenderer();
        }
    }

    /**
     * Disposes the component and the associated resources
     */
    public dispose(): void {
        this.scene.disableFluidRenderer();
    }
}

FluidRenderer._SceneComponentInitialization = (scene: Scene) => {
    let component = scene._getComponent(SceneComponentConstants.NAME_FLUIDRENDERER) as FluidRendererSceneComponent;
    if (!component) {
        component = new FluidRendererSceneComponent(scene);
        scene._addComponent(component);
    }
};
