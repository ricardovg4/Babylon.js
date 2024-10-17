import type { NodeMaterial } from "../nodeMaterial";
import type { IDisposable } from "core/scene";
import type { Nullable } from "core/types";
import { Observable } from "core/Misc/observable";
import { Matrix } from "core/Maths/math.vector";
import { NodeMaterialSystemValues } from "../Enums/nodeMaterialSystemValues";
import { ShaderMaterial } from "core/Materials/shaderMaterial";

/**
 * Interface used to describe a uniform entry in the ledger
 */
export interface IUniformLedgerEntry {
    /**
     * Defines the system value type for this uniform (a value provided by the system)
     */
    systemValueType?: NodeMaterialSystemValues;
    /**
     * Direct value to send to the shader
     */
    directValue?: any;
}

/**
 * Class used to replay a shader generated by a Node Material
 * Without the need of a full Node Material
 * #KLE1T7#3 - Simple color
 * #KLE1T7#4 - Texture
 */
export class NodeMaterialRuntimeHelper implements IDisposable {
    private _material: NodeMaterial;
    private _shaderMaterial: Nullable<ShaderMaterial>;
    private _uniformLedger: { [key: string]: IUniformLedgerEntry } = {};

    private _cachedWorldViewMatrix = Matrix.Identity();
    private _cachedWorldViewProjectionMatrix = Matrix.Identity();

    /**
     * Observable raised when the shader material is created
     */
    public onShaderMaterialCreatedObservable = new Observable<ShaderMaterial>(undefined, true);

    /**
     * Gets direct access to the ledger so you can change value directly
     */
    public get ledger() {
        return this._uniformLedger;
    }

    /**
     * Creates a new NodeMaterialRuntimeHelper
     * @param material defines the material to replay
     */
    public constructor(material: NodeMaterial) {
        this._material = material;

        // Extract effect
        this._material.onBuildObservable.addOnce(() => {
            // Code
            const strings = this._material.compilationStrings;

            // List of uniforms
            const uniforms: string[] = [];
            for (const inputBlock of this._material.getInputBlocks()) {
                if (inputBlock.isUniform) {
                    uniforms.push(inputBlock.associatedVariableName);

                    const entry: IUniformLedgerEntry = {};
                    this._uniformLedger[inputBlock.associatedVariableName] = entry;

                    if (inputBlock.isSystemValue) {
                        entry.systemValueType = inputBlock.systemValue!;
                    } else {
                        if (inputBlock.value) {
                            entry.directValue = inputBlock.value;
                        }
                    }
                }
            }

            // Create shader material
            this._shaderMaterial = new ShaderMaterial(
                "shaderMaterial",
                this._material.getScene(),
                {
                    vertexSource: strings.vertex,
                    fragmentSource: strings.fragment,
                },
                {
                    uniforms: uniforms,
                }
            );

            // Connect to events
            this._shaderMaterial.onBindObservable.add((mesh) => {
                const effect = this._shaderMaterial!.getEffect();
                const scene = this._material.getScene();
                for (const key in this._uniformLedger) {
                    const entry = this._uniformLedger[key];
                    if (entry.systemValueType) {
                        switch (entry.systemValueType) {
                            case NodeMaterialSystemValues.World:
                                effect.setMatrix(key, mesh.getWorldMatrix());
                                break;
                            case NodeMaterialSystemValues.WorldView:
                                mesh.getWorldMatrix().multiplyToRef(scene.getViewMatrix(), this._cachedWorldViewMatrix);
                                effect.setMatrix(key, this._cachedWorldViewMatrix);
                                break;
                            case NodeMaterialSystemValues.WorldViewProjection:
                                mesh.getWorldMatrix().multiplyToRef(scene.getTransformMatrix(), this._cachedWorldViewProjectionMatrix);
                                effect.setMatrix(key, this._cachedWorldViewProjectionMatrix);
                                break;
                                return;
                            case NodeMaterialSystemValues.View:
                                effect.setMatrix(key, scene.getViewMatrix());
                                break;
                            case NodeMaterialSystemValues.Projection:
                                effect.setMatrix(key, scene.getProjectionMatrix());
                                break;
                            case NodeMaterialSystemValues.ViewProjection:
                                effect.setMatrix(key, scene.getTransformMatrix());
                                break;
                            case NodeMaterialSystemValues.CameraPosition:
                                scene.bindEyePosition(effect, key, true);
                                break;
                            case NodeMaterialSystemValues.FogColor:
                                effect.setColor3(key, scene.fogColor);
                                break;
                            case NodeMaterialSystemValues.DeltaTime:
                                effect.setFloat(key, scene.deltaTime / 1000.0);
                                break;
                            case NodeMaterialSystemValues.CameraParameters:
                                if (scene.activeCamera) {
                                    effect.setFloat4(
                                        key,
                                        scene.getEngine().hasOriginBottomLeft ? -1 : 1,
                                        scene.activeCamera.minZ,
                                        scene.activeCamera.maxZ,
                                        1 / scene.activeCamera.maxZ
                                    );
                                }
                                break;
                        }
                    } else {
                        const value = entry.directValue;

                        if (value) {
                            switch (value.getClassName()) {
                                case "Vector3":
                                    effect.setVector3(key, value);
                                    break;
                                case "Vector4":
                                    effect.setVector4(key, value);
                                    break;
                                case "Color3":
                                    effect.setColor3(key, value);
                                    break;
                                case "Color4":
                                    effect.setColor4(key, value, value.a);
                                    break;
                            }
                        }
                    }
                }
            });

            this.onShaderMaterialCreatedObservable.notifyObservers(this._shaderMaterial);
        });
    }

    /**
     * Gets the current class name e.g. "NodeMaterialRuntimeHelper"
     * @returns the class name
     */
    public getClassName() {
        return "NodeMaterialRuntimeHelper";
    }

    /**
     * Disposes the LightPlayer
     */
    dispose(): void {
        if (this._shaderMaterial) {
            this._shaderMaterial.dispose();
            this._shaderMaterial = null;
        }

        this.onShaderMaterialCreatedObservable.clear();
    }
}
