import React, {Component} from 'react';
import './index.css'
import '../public/openseadragon-bin-2.4.0/OpenSeadragonLoader.js'
import '../public/openseadragon-bin-2.4.0/viaWebGL'
import '../public/openseadragon-bin-2.4.0/openSeadragonGL'
import '../public/openseadragon-bin-2.4.0/openseadragon-svg-overlay'
import '../public/openseadragon-bin-2.4.0/openseadragon-filtering'
import '../public/openseadragon-bin-2.4.0/canvas-overlay-hd'
import '../public/openseadragon-bin-2.4.0/openseadragonrgb'


export default class OpenSeadragonComponent extends Component {
    constructor(props) {
        super(props);
        var tileSource = {
            Image: {
                xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                Url: "http://openseadragon.github.io/example-images/highsmith/highsmith_files/",
                Format: "jpg",
                Overlap: "2",
                TileSize: "256",
                Size: {
                    Height: "9221",
                    Width: "7026"
                }
            }
        };
        this.state = {
            options: {
                id: "viewer",
                prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon/build/openseadragon/images/",
                tileSources: [{
                    tileSource: {
                        Image: {
                            xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                            Url: "http://openseadragon.github.io/example-images/highsmith/highsmith_files/",
                            Format: "jpg",
                            Overlap: "2",
                            TileSize: "256",
                            Size: {
                                Height: "9221",
                                Width: "7026"
                            }
                        }
                    },
                    width: 2,
                    y: 0.5,
                    x: 0.5
                }]
            }
        };
    }

    componentDidMount() {
        this.initialiseWidgets();
    }

    componentDidUpdate() {
        this.initialiseWidgets();
    }

    initialiseWidgets() {
        // eslint-disable-next-line no-undef
        this.viewer = global.OpenSeadragon(this.state.options);
        const overlay = new global.OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: function (opts) {
                const context = opts.context;
                context.fillStyle = "#a6cee3";
                context.beginPath();
                context.arc(150, 150, 150, 0, Math.PI * 2, true);
                context.fill();
            }
        });

    }

    render() {
        return (
            <div id={this.state.options.id}>
            </div>
        );
    }
};