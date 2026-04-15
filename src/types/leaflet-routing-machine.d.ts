declare namespace L {
    namespace Routing {
        function control(options: any): any;

        class Control {
            addTo(map: any): this;
            remove(): void;
        }

        class Waypoint {}
    }
}
