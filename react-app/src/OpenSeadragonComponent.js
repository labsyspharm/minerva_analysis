import React, {Component} from 'react';
import './index.css'

import OpenSeadragon from 'openseadragon';  // OpenSeadragon on global scope
// import ScriptTag from 'react-script-tag';


export default class OpenSeadragonComponent extends Component {
    constructor(props) {
        super(props);
        const image = {
            Image: {
                xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                Url: "//openseadragon.github.io/example-images/duomo/duomo_files/",
                Format: "jpg",
                Overlap: "2",
                TileSize: "256",
                Size: {
                    Width: "13920",
                    Height: "10200"
                }
            }
        };
        this.state = {
            options: {
                id: "viewer",
                prefixUrl: "//openseadragon.github.io/openseadragon/images/",
                tileSources: image
            },
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
        this.viewer = OpenSeadragon(this.state.options);
    }

    render() {
        return (
            <div id={this.state.options.id}>
            </div>
        );
    }
};